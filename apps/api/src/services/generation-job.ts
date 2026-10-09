import { createHash, randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { AIQuestionSetOutputSchema, BackendQuestionSetSchema, InsufficientSourceSchema, JobStateSchema,
  type AIQuestionSetOutput, type BackendQuestionSet, type GenerationJob, type GenerationMetadata, type LibraryDocument } from "@point-nemo/shared";
import type { ApiConfig } from "../config.js";
import { ApiError, BadRequestError, BusyError, ConflictError, NotFoundError, ServiceUnavailableError } from "../errors.js";
import type { SqliteDatabase } from "../db.js";
import { admitPdf, LocalPdfExtractor, type DocumentExtractor, type ExtractedDocument, type UploadedDocument } from "./document-extractor.js";
import { OllamaService, generationMessages } from "./ollama.js";
import { generationMetadata, isCompatibleMetadata } from "./generation-metadata.js";
import { checkTokenBudget, localTokenizer, tokenizerStatus, type TokenCounter } from "./token-budget.js";
import { GameRunService } from "./game-run.js";

interface SourceChunk { pageNumber: number; chunkId: string; text: string }
interface JobRow { id: string; document_id: string; state: string; question_set_id: string | null; error_code: string | null;
  error_message: string | null; error_stage: "extracting" | "generating" | "validating" | null; started_at: string; finished_at: string | null;
  cancel_requested: number; retry_count: number; timings_json: string }
interface SetRow { id: string; document_id: string; created_at: string; model_tag: string; model_digest: string; settings_hash: string;
  document_hash: string; extractor_version: string; prompt_version: string; schema_version: string; tokenizer_digest: string; filename: string; pages_json: string; sha256: string }

export function sqliteTimestampToIso(value: string): string {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`).toISOString();
}
function key(value: string): string { return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase(); }
function stemKey(value: string): string { return key(value).replace(/[^\p{L}\p{N}\s]/gu, "").trim(); }
function parseChunks(pagesJson: string): SourceChunk[] {
  const pages: unknown = JSON.parse(pagesJson);
  if (!Array.isArray(pages) || pages.some((p) => !p || typeof p.pageNumber !== "number" || typeof p.chunkId !== "string" || typeof p.text !== "string")) {
    throw new BadRequestError("INVALID_SOURCE", "Extracted source pages are invalid.");
  }
  return pages as SourceChunk[];
}

function findExactOrFuzzyQuote(
  evidence: { pageNumber: number; chunkId: string; quote: string },
  pages: SourceChunk[]
): boolean {
  const citedChunk = pages.find((p) => p.chunkId === evidence.chunkId && p.pageNumber === evidence.pageNumber);
  const cleanEvidenceQuote = evidence.quote.normalize("NFC").trim().replace(/\s+/g, " ");
  if (citedChunk && (citedChunk.text.includes(evidence.quote) || citedChunk.text.includes(cleanEvidenceQuote))) {
    return true;
  }

  for (const page of pages) {
    if (page.text.includes(evidence.quote) || page.text.includes(cleanEvidenceQuote)) {
      evidence.pageNumber = page.pageNumber;
      evidence.chunkId = page.chunkId;
      return true;
    }
  }

  const normQuote = cleanEvidenceQuote.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (normQuote.length >= 15) {
    for (const page of pages) {
      const normPage = page.text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
      if (normPage.includes(normQuote)) {
        const sentences = page.text.split(/(?<=[.!?\n])\s+/);
        for (const sentence of sentences) {
          const normSent = sentence.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
          if (normSent.includes(normQuote) || normQuote.includes(normSent)) {
            const snapped = sentence.trim();
            if (snapped.length >= 20 && snapped.length <= 400) {
              evidence.quote = snapped;
              evidence.pageNumber = page.pageNumber;
              evidence.chunkId = page.chunkId;
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

export function validateGeneratedOutput(output: unknown, pagesJson: string): AIQuestionSetOutput {
  if (InsufficientSourceSchema.safeParse(output).success) throw new BadRequestError("INSUFFICIENT_SOURCE", "The source does not support three distinct topics and nine reliable questions. Export a richer text excerpt.");
  const parsed = AIQuestionSetOutputSchema.parse(output);
  const pages = parseChunks(pagesJson), topics = new Set(parsed.topics.map((topic) => key(topic.name)));
  if (topics.size !== 3) throw new BadRequestError("INVALID_MODEL_OUTPUT", "The model returned duplicate topics.");
  const coverage = new Set<string>(), stems = new Set<string>();
  for (const question of parsed.questions) {
    const topic = key(question.topicName), coverageKey = `${topic}:${question.difficulty}`, stem = stemKey(question.prompt);
    if (!topics.has(topic) || coverage.has(coverageKey)) throw new BadRequestError("INVALID_MODEL_OUTPUT", "Every topic needs exactly one easy, medium, and hard question.");
    if (!stem || stems.has(stem)) throw new BadRequestError("DUPLICATE_QUESTION", "The model returned duplicate question stems.");
    const uniqueOptions = new Set(question.options.map(key));
    if (uniqueOptions.size !== 4) throw new BadRequestError("INVALID_MODEL_OUTPUT", `In ${question.topicName} (${question.difficulty}), all four answer options must be distinct.`);
    coverage.add(coverageKey); stems.add(stem);
    for (const evidence of question.evidence) {
      if (!findExactOrFuzzyQuote(evidence, pages)) {
        throw new BadRequestError("SOURCE_EVIDENCE_INVALID", "An evidence quote is not an exact passage in its cited page and chunk of this document.");
      }
    }
  }
  if (coverage.size !== 9) throw new BadRequestError("INVALID_MODEL_OUTPUT", "The model returned incomplete topic/difficulty coverage.");
  return parsed;
}

const repairable = new Set(["INVALID_MODEL_OUTPUT", "OLLAMA_INVALID_JSON", "SOURCE_EVIDENCE_INVALID", "DUPLICATE_QUESTION"]);
function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof ZodError) return { code: "INVALID_MODEL_OUTPUT", message: "The model returned invalid question fields, counts, or lengths." };
  if (error instanceof ApiError) return { code: error.code, message: error.message };
  return { code: "GENERATION_FAILED", message: "Local generation failed. Check local setup and retry this document." };
}
async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort: (() => void) | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason); signal.addEventListener("abort", abort, { once: true });
  })]); } finally { if (abort) signal.removeEventListener("abort", abort); }
}

export class GenerationJobService {
  private activeJobId: string | null = null;
  private readonly controllers = new Map<string, AbortController>();
  private modelDigest = "";

  constructor(private readonly database: SqliteDatabase, private readonly config: ApiConfig,
    private readonly extractor: DocumentExtractor = new LocalPdfExtractor(), private readonly ollama: OllamaService = new OllamaService(config),
    private readonly tokenCounter?: TokenCounter) {
    this.database.prepare(`UPDATE generation_jobs SET error_stage = state, state = 'failed', error_code = 'INTERRUPTED_JOB',
      error_message = 'The app stopped before this job finished. Upload again to retry.', finished_at = ?
      WHERE state IN ('extracting','generating','validating')`).run(new Date().toISOString());
  }

  async enqueue(file: UploadedDocument): Promise<{ documentId: string; jobId: string }> {
    admitPdf(file);
    if (this.activeJobId) throw new BusyError("GENERATION_BUSY", "Another document is being processed. Cancel it or wait before uploading.");
    const documentId = randomUUID(), jobId = randomUUID(), createdAt = new Date().toISOString();
    const hash = createHash("sha256").update(file.buffer).digest("hex");
    this.database.transaction(() => {
      this.database.prepare("INSERT INTO documents (id,filename,sha256,page_count,normalized_char_count,pages_json,created_at) VALUES (?,?,?,1,0,'[]',?)")
        .run(documentId, file.originalName.replace(/^.*[\\/]/, "").slice(0, 255), hash, createdAt);
      this.database.prepare("INSERT INTO generation_jobs (id,document_id,state,started_at) VALUES (?,?,'extracting',?)").run(jobId, documentId, createdAt);
    })();
    this.activeJobId = jobId;
    const controller = new AbortController(); this.controllers.set(jobId, controller);
    void this.run(jobId, documentId, file, controller).finally(() => {
      this.controllers.delete(jobId); if (this.activeJobId === jobId) this.activeJobId = null;
    });
    return { documentId, jobId };
  }

  getJob(id: string): GenerationJob {
    const row = this.database.prepare("SELECT * FROM generation_jobs WHERE id=?").get(id) as JobRow | undefined;
    if (!row) throw new NotFoundError("JOB_NOT_FOUND", "Generation job was not found.");
    const start = Date.parse(sqliteTimestampToIso(row.started_at)), finish = row.finished_at ? Date.parse(sqliteTimestampToIso(row.finished_at)) : Date.now();
    return { id: row.id, documentId: row.document_id, state: JobStateSchema.parse(row.state), questionSetId: row.question_set_id ?? undefined,
      errorCode: row.error_code ?? undefined, errorMessage: row.error_message ?? undefined, errorStage: row.error_stage ?? undefined,
      elapsedTimeMs: Math.max(0, finish - start), createdAt: sqliteTimestampToIso(row.started_at), retryCount: row.retry_count, timings: JSON.parse(row.timings_json) };
  }

  cancelJob(id: string): GenerationJob {
    const job = this.getJob(id);
    if (["extracting", "generating", "validating"].includes(job.state)) {
      this.database.prepare("UPDATE generation_jobs SET state='cancelled',cancel_requested=1,finished_at=? WHERE id=? AND state IN ('extracting','generating','validating')")
        .run(new Date().toISOString(), id);
      this.controllers.get(id)?.abort(new BadRequestError("JOB_CANCELLED", "Generation was cancelled."));
    }
    return this.getJob(id);
  }

  deleteDocument(id: string): void {
    const jobs = this.database.prepare("SELECT id FROM generation_jobs WHERE document_id=?").all(id) as Array<{id:string}>;
    for (const job of jobs) this.cancelJob(job.id);
    this.database.transaction(() => {
      this.database.prepare("DELETE FROM runs WHERE question_set_id IN (SELECT id FROM question_sets WHERE document_id=?)").run(id);
      this.database.prepare("DELETE FROM question_sets WHERE document_id=?").run(id);
      this.database.prepare("DELETE FROM documents WHERE id=?").run(id);
    })();
  }

  getQuestionSet(id: string): BackendQuestionSet {
    const row = this.database.prepare("SELECT q.*,d.filename,d.pages_json,d.sha256 FROM question_sets q JOIN documents d ON d.id=q.document_id WHERE q.id=?").get(id) as SetRow | undefined;
    if (!row) throw new NotFoundError("QUESTION_SET_NOT_FOUND", "Question set was not found.");
    const topics = this.database.prepare("SELECT id,name FROM topics_p0 WHERE question_set_id=? ORDER BY rowid").all(id);
    const rows = this.database.prepare("SELECT * FROM questions_p0 WHERE question_set_id=? ORDER BY rowid").all(id) as Array<{id:string;topic_id:string;difficulty:string;prompt:string;options_json:string;answer_index:number;explanation:string;evidence_json:string}>;
    const metadata: GenerationMetadata = { documentHash: row.document_hash, extractorVersion: row.extractor_version, promptVersion: row.prompt_version,
      schemaVersion: row.schema_version, tokenizerDigest: row.tokenizer_digest, modelTag: row.model_tag, modelDigest: row.model_digest,
      settingsHash: row.settings_hash, createdAt: sqliteTimestampToIso(row.created_at) };
    const tokenizer = tokenizerStatus();
    return BackendQuestionSetSchema.parse({ id: row.id, documentId: row.document_id, filename: row.filename, topics, extractedPages: parseChunks(row.pages_json), metadata,
      compatible: metadata.documentHash === row.sha256 && isCompatibleMetadata(metadata, this.config, this.modelDigest, this.tokenCounter?.digest ?? tokenizer.digest ?? ""),
      questions: rows.map((q) => ({id:q.id,topicId:q.topic_id,difficulty:q.difficulty,prompt:q.prompt,options:JSON.parse(q.options_json),answerIndex:q.answer_index,explanation:q.explanation,evidence:JSON.parse(q.evidence_json)})),
      createdAt: sqliteTimestampToIso(row.created_at) });
  }

  async requireCompatibleQuestionSet(id: string): Promise<void> {
    const status = await this.ollama.getStatus(); this.modelDigest = status.digest ?? this.modelDigest;
    if (!this.getQuestionSet(id).compatible) throw new ConflictError("INCOMPATIBLE_SAVED_SET", "These saved questions use a different source or runtime version. Upload the document for fresh generation.");
  }

  async listDocuments(): Promise<LibraryDocument[]> {
    const status = await this.ollama.getStatus(); this.modelDigest = status.digest ?? this.modelDigest;
    const documents = this.database.prepare("SELECT * FROM documents ORDER BY created_at DESC,rowid DESC").all() as Array<{id:string;filename:string;sha256:string;page_count:number;normalized_char_count:number;created_at:string}>;
    const game = new GameRunService(this.database), allRuns = game.listRuns();
    return documents.map((d) => {
      const sets = this.database.prepare("SELECT id FROM question_sets WHERE document_id=? ORDER BY created_at DESC,rowid DESC").all(d.id) as Array<{id:string}>;
      const jobIds = this.database.prepare("SELECT id FROM generation_jobs WHERE document_id=? ORDER BY started_at DESC,rowid DESC").all(d.id) as Array<{id:string}>;
      const runs = allRuns.filter((run) => run.documentId === d.id), jobs = jobIds.map((j) => this.getJob(j.id));
      const createdAt = sqliteTimestampToIso(d.created_at), updatedAt = [createdAt, ...runs.map((r) => r.updatedAt ?? r.createdAt), ...jobs.map((j) => new Date(Date.parse(j.createdAt) + (j.elapsedTimeMs ?? 0)).toISOString())].sort().at(-1)!;
      return { id:d.id,filename:d.filename,sha256:d.sha256,pageCount:d.page_count,normalizedCharacterCount:d.normalized_char_count,createdAt,updatedAt,
        questionSets:sets.map((s) => this.getQuestionSet(s.id)), runs, jobs };
    }).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private checkActive(jobId: string, signal: AbortSignal, deadline: number): void {
    signal.throwIfAborted();
    if (Date.now() >= deadline) throw new ServiceUnavailableError("JOB_TIMEOUT", "The complete generation job exceeded its deadline. Export a smaller excerpt and retry.");
    const row = this.database.prepare("SELECT state,cancel_requested FROM generation_jobs WHERE id=?").get(jobId) as {state:string;cancel_requested:number} | undefined;
    if (!row || row.cancel_requested || ["cancelled","failed","ready"].includes(row.state)) throw new BadRequestError("JOB_CANCELLED", "Generation was cancelled or deleted.");
  }

  private async run(jobId: string, documentId: string, file: UploadedDocument, controller: AbortController): Promise<void> {
    const start = Date.now(), deadline = start + this.config.jobTimeoutMs, signal = controller.signal;
    const timer = setTimeout(() => controller.abort(new ServiceUnavailableError("JOB_TIMEOUT", "The complete generation job exceeded its deadline. Export a smaller excerpt and retry.")), this.config.jobTimeoutMs);
    const timings: Record<string, number> = {};
    let stage: "extracting" | "generating" | "validating" = "extracting";
    let stageStart = start;
    const transition = (next: typeof stage) => {
      this.checkActive(jobId, signal, deadline); stage = next; stageStart = Date.now();
      this.database.prepare("UPDATE generation_jobs SET state=? WHERE id=?").run(next, jobId);
    };
    try {
      const extracted = await abortable(this.extractor.extractText(file, signal), signal);
      this.checkActive(jobId, signal, deadline); timings.extractionMs = Date.now() - stageStart;
      // Raw PDFs are never retained. Only normalized pages and the original byte hash remain.
      const documentHash = createHash("sha256").update(file.buffer).digest("hex"); file.buffer = Buffer.alloc(0);
      this.database.prepare("UPDATE documents SET page_count=?,normalized_char_count=?,pages_json=? WHERE id=?")
        .run(extracted.pageCount, extracted.normalizedCharCount, extracted.pagesJson, documentId);
      transition("generating");
      const status = await abortable(this.ollama.getStatus(signal), signal);
      this.checkActive(jobId, signal, deadline);
      if (!status.available || !status.digest) throw new ServiceUnavailableError("OLLAMA_UNAVAILABLE", status.message);
      this.modelDigest = status.digest;
      const counter = this.tokenCounter ?? localTokenizer();
      const allChunks = parseChunks(extracted.pagesJson);
      let chunksToUse = allChunks;
      if (allChunks.length > 3) {
        const substantive = allChunks.filter((c) => c.text.replace(/\s/g, "").length >= 50);
        chunksToUse = substantive.length >= 3 ? substantive.slice(0, 3) : allChunks.slice(0, 3);
      }
      const source = chunksToUse.map((p) => `[Page ${p.pageNumber} | ${p.chunkId}]\n${p.text}`).join("\n\n");
      let feedback: string | undefined, validated: AIQuestionSetOutput | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        this.checkActive(jobId, signal, deadline);
        timings[attempt ? "repairInputTokens" : "inputTokens"] = checkTokenBudget(generationMessages(source, feedback), this.config.ollamaMaxInputTokens, counter);
        const inferenceStart = Date.now();
        try {
          const attemptSignal = AbortSignal.any([signal, AbortSignal.timeout(this.config.inferenceTimeoutMs)]);
          const output = await abortable(this.ollama.generateQuestions(source, { signal: attemptSignal, repairFeedback: feedback }), attemptSignal)
            .catch((error: unknown) => { if (signal.aborted) throw signal.reason; if (attemptSignal.aborted) throw new ServiceUnavailableError("INFERENCE_TIMEOUT", "Local inference timed out."); throw error; });
          timings.generationMs = (timings.generationMs ?? 0) + Date.now() - inferenceStart;
          transition("validating"); validated = validateGeneratedOutput(output, extracted.pagesJson);
          break;
        } catch (error) {
          timings.generationMs = timings.generationMs ?? Date.now() - inferenceStart;
          const safe = safeError(error);
          if (attempt !== 0 || !repairable.has(safe.code)) throw error;
          this.checkActive(jobId, signal, deadline);
          feedback = `${safe.code}: ${safe.message}`;
          this.database.prepare("UPDATE generation_jobs SET retry_count=1 WHERE id=?").run(jobId);
          transition("generating");
        }
      }
      if (!validated) throw new BadRequestError("INVALID_MODEL_OUTPUT", "The model did not produce a complete valid set.");
      this.checkActive(jobId, signal, deadline);
      const metadata = generationMetadata(this.config, status.digest, counter.digest, documentHash);
      this.persistQuestionSet(documentId, jobId, validated, metadata, () => this.checkActive(jobId, signal, deadline));
      timings.validationStorageMs = Date.now() - stageStart;
    } catch (error) {
      const safe = safeError(error);
      this.database.prepare(`UPDATE generation_jobs SET state='failed',error_code=?,error_message=?,error_stage=?,finished_at=?
        WHERE id=? AND state IN ('extracting','generating','validating')`).run(safe.code, safe.message, stage, new Date().toISOString(), jobId);
    } finally {
      clearTimeout(timer); file.buffer = Buffer.alloc(0); timings.totalMs = Date.now() - start;
      try { this.database.prepare("UPDATE generation_jobs SET timings_json=? WHERE id=?").run(JSON.stringify(timings), jobId); } catch { /* App shutdown may already have closed the database. */ }
    }
  }

  private persistQuestionSet(documentId: string, jobId: string, output: AIQuestionSetOutput, metadata: GenerationMetadata, check: () => void): void {
    const setId = randomUUID(), topics = new Map(output.topics.map((t) => [key(t.name), randomUUID()]));
    this.database.transaction(() => {
      check();
      this.database.prepare(`INSERT INTO question_sets (id,document_id,model_tag,model_digest,settings_hash,extractor_version,prompt_version,schema_version,tokenizer_digest,document_hash,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(setId,documentId,metadata.modelTag,metadata.modelDigest,metadata.settingsHash,metadata.extractorVersion,metadata.promptVersion,metadata.schemaVersion,metadata.tokenizerDigest,metadata.documentHash,metadata.createdAt);
      const insertTopic = this.database.prepare("INSERT INTO topics_p0 (id,question_set_id,name) VALUES (?,?,?)");
      for (const t of output.topics) insertTopic.run(topics.get(key(t.name)),setId,t.name);
      const insertQuestion = this.database.prepare(`INSERT INTO questions_p0 (id,question_set_id,topic_id,difficulty,prompt,options_json,answer_index,explanation,evidence_json) VALUES (?,?,?,?,?,?,?,?,?)`);
      for (const q of output.questions) insertQuestion.run(randomUUID(),setId,topics.get(key(q.topicName)),q.difficulty,q.prompt,JSON.stringify(q.options),q.answerIndex,q.explanation,JSON.stringify(q.evidence));
      check();
      this.database.prepare("UPDATE generation_jobs SET state='ready',question_set_id=?,finished_at=? WHERE id=?").run(setId,new Date().toISOString(),jobId);
    })();
  }
}
