import { createHash, randomUUID } from "node:crypto";
import type { MvpQuestionSetDraft } from "@point-nemo/shared";
import { MvpQuestionSetDraftSchema } from "@point-nemo/shared";
import type { SqliteDatabase } from "../db.js";
import { ApiError, ConflictError, NotFoundError } from "../errors.js";
import { EXTRACTOR_VERSION, PdfDocumentExtractor, type ExtractedDocument, type ExtractedPage, type UploadedDocument } from "./document-extractor.js";
import { OllamaService } from "./ollama.js";

const JOB_TIMEOUT_MS = 90_000;
const PROMPT_VERSION = "point-nemo-questions-v1";
const QUESTION_SCHEMA_VERSION = "question-set-v1";
export const GAME_RULES_VERSION = "point-nemo-rules-v1";

type JobState = "extracting" | "generating" | "validating" | "ready" | "failed" | "cancelled";

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

function validateQuestionSet(candidate: unknown, pages: ExtractedPage[]): { draft?: MvpQuestionSetDraft; issues: string[] } {
  const parsed = MvpQuestionSetDraftSchema.safeParse(candidate);
  if (!parsed.success) {
    return { issues: parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`) };
  }
  const draft = parsed.data;
  const issues: string[] = [];
  const topicKeys = draft.topics.map((topic) => topic.key);
  const normalizedKeys = topicKeys.map(normalize);
  const normalizedTitles = draft.topics.map((topic) => normalize(topic.title));
  if (new Set(normalizedKeys).size !== 3 || new Set(normalizedTitles).size !== 3) {
    issues.push("topics must have three distinct keys and titles");
  }
  const topicSet = new Set(topicKeys);
  const coverage = new Set<string>();
  const stems = new Set<string>();

  for (const question of draft.questions) {
    if (!topicSet.has(question.topicKey)) {
      issues.push(`question topicKey ${question.topicKey} does not match a declared topic`);
      continue;
    }
    const pair = `${question.topicKey}:${question.difficulty}`;
    if (coverage.has(pair)) issues.push(`duplicate topic/difficulty pair ${pair}`);
    coverage.add(pair);

    const stem = normalize(question.question);
    if (stems.has(stem)) issues.push("question stems must be unique");
    stems.add(stem);
    if (new Set(question.options.map(normalize)).size !== 4) issues.push(`options must be distinct for ${pair}`);

    const page = pages.find((entry) => entry.pageNumber === question.evidence.page);
    if (!page || question.evidence.quote.length < 20 || !page.text.includes(question.evidence.quote.trim().normalize("NFKC").replace(/\s+/gu, " "))) {
      issues.push(`evidence quote must exactly match page ${question.evidence.page} for ${pair}`);
    }
  }

  const expected = new Set(topicKeys.flatMap((key) => ["easy", "medium", "hard"].map((difficulty) => `${key}:${difficulty}`)));
  if (coverage.size !== 9 || [...expected].some((pair) => !coverage.has(pair))) {
    issues.push("every topic must have exactly one easy, one medium, and one hard question");
  }
  return issues.length ? { draft, issues: issues.slice(0, 12) } : { draft, issues: [] };
}

function buildQuestionSetRecords(draft: MvpQuestionSetDraft) {
  const questionSetId = randomUUID();
  const topicIdByKey = new Map<string, string>();
  const topics = draft.topics.map((topic, ordinal) => {
    const id = randomUUID();
    topicIdByKey.set(topic.key, id);
    return { id, ...topic, ordinal };
  });
  const difficultyOrder = { easy: 0, medium: 1, hard: 2 } as const;
  const topicOrder = new Map(topics.map((topic) => [topic.key, topic.ordinal]));
  const questions = [...draft.questions]
    .sort((left, right) => (difficultyOrder[left.difficulty] - difficultyOrder[right.difficulty])
      || ((topicOrder.get(left.topicKey) ?? 0) - (topicOrder.get(right.topicKey) ?? 0)))
    .map((question, ordinal) => ({
      id: randomUUID(),
      topicId: topicIdByKey.get(question.topicKey)!,
      topicKey: question.topicKey,
      difficulty: question.difficulty,
      prompt: question.question,
      options: question.options,
      correctOptionIndex: question.correctOptionIndex,
      explanation: question.explanation,
      evidencePage: question.evidence.page,
      evidenceQuote: question.evidence.quote,
      ordinal,
    }));
  return { questionSetId, topics, questions };
}

interface StoredPageDocument {
  pageCount: number;
  normalizedChars: number;
  normalizedText: string;
  pages: ExtractedPage[];
}

export class GenerationService {
  private readonly active = new Map<string, AbortController>();

  constructor(
    private readonly database: SqliteDatabase,
    private readonly extractor: PdfDocumentExtractor,
    private readonly ollama: OllamaService,
  ) {
    this.database.prepare(`
      UPDATE generation_jobs
      SET state = 'failed', error_code = 'SERVER_RESTARTED',
          error_message = 'Processing stopped when the local app restarted.',
          updated_at = CURRENT_TIMESTAMP, finished_at = CURRENT_TIMESTAMP
      WHERE state IN ('extracting', 'generating', 'validating')
    `).run();
  }

  acceptUpload(file: UploadedDocument): { documentId: string; jobId: string } {
    this.assertNoActiveJob();
    const documentId = randomUUID();
    const jobId = randomUUID();
    const sourceName = file.originalName.replace(/[\\/]/gu, "_").slice(-180) || "upload.pdf";
    const hash = createHash("sha256").update(file.buffer).digest("hex");
    const transaction = this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO documents (id, source_name, source_sha256)
        VALUES (?, ?, ?)
      `).run(documentId, sourceName, hash);
      this.database.prepare(`
        INSERT INTO generation_jobs (id, document_id, state)
        VALUES (?, ?, 'extracting')
      `).run(jobId, documentId);
    });
    transaction();

    const fileCopy: UploadedDocument = { ...file, buffer: new Uint8Array(file.buffer) };
    this.launch(jobId, (signal) => this.processUpload(jobId, documentId, fileCopy, signal));
    return { documentId, jobId };
  }

  getJob(jobId: string) {
    const row = this.database.prepare(`
      SELECT j.id, j.document_id AS documentId, j.state, j.created_at AS createdAt,
             j.updated_at AS updatedAt, j.finished_at AS finishedAt,
             j.question_set_id AS questionSetId, j.error_code AS errorCode, j.error_message AS errorMessage,
             d.extracted_pages_json AS extractedPagesJson
      FROM generation_jobs j JOIN documents d ON d.id = j.document_id WHERE j.id = ?
    `).get(jobId) as {
      id: string; documentId: string; state: JobState; createdAt: string; updatedAt: string;
      finishedAt: string | null; questionSetId: string | null; errorCode: string | null; errorMessage: string | null;
      extractedPagesJson: string | null;
    } | undefined;
    if (!row) throw new NotFoundError("JOB_NOT_FOUND", "The processing job was not found.");
    const startTime = Date.parse(`${row.createdAt.replace(" ", "T")}Z`);
    const endTime = row.finishedAt ? Date.parse(`${row.finishedAt.replace(" ", "T")}Z`) : Date.now();
    return {
      id: row.id,
      documentId: row.documentId,
      state: row.state,
      elapsedMs: Number.isFinite(startTime) ? Math.max(0, endTime - startTime) : 0,
      updatedAt: row.updatedAt,
      questionSetId: row.questionSetId,
      error: row.errorCode ? { code: row.errorCode, message: row.errorMessage ?? "Processing failed.", retryable: row.state === "failed" && Boolean(row.extractedPagesJson) } : null,
    };
  }

  cancelJob(jobId: string) {
    const job = this.database.prepare("SELECT state FROM generation_jobs WHERE id = ?").get(jobId) as { state: JobState } | undefined;
    if (!job) throw new NotFoundError("JOB_NOT_FOUND", "The processing job was not found.");
    if (["ready", "failed", "cancelled"].includes(job.state)) return this.getJob(jobId);
    this.active.get(jobId)?.abort(new Error("Cancelled"));
    this.database.prepare(`
      UPDATE generation_jobs SET state = 'cancelled', error_code = NULL, error_message = NULL,
        updated_at = CURRENT_TIMESTAMP, finished_at = CURRENT_TIMESTAMP
      WHERE id = ? AND state IN ('extracting', 'generating', 'validating')
    `).run(jobId);
    return this.getJob(jobId);
  }

  retryJob(jobId: string): { jobId: string; documentId: string } {
    this.assertNoActiveJob();
    const previous = this.database.prepare(`
      SELECT j.state, j.document_id AS documentId, d.extracted_pages_json AS extractedPagesJson
      FROM generation_jobs j JOIN documents d ON d.id = j.document_id WHERE j.id = ?
    `).get(jobId) as { state: JobState; documentId: string; extractedPagesJson: string | null } | undefined;
    if (!previous) throw new NotFoundError("JOB_NOT_FOUND", "The processing job was not found.");
    if (previous.state !== "failed") throw new ConflictError("JOB_NOT_RETRYABLE", "Only a failed job can be retried.");
    if (!previous.extractedPagesJson) throw new ConflictError("EXTRACTION_REQUIRED", "Extraction did not complete. Upload the PDF again to retry.");

    let extracted: StoredPageDocument;
    try {
      extracted = JSON.parse(previous.extractedPagesJson) as StoredPageDocument;
    } catch {
      throw new ConflictError("EXTRACTION_UNAVAILABLE", "Saved extracted text is unavailable. Upload the PDF again to retry.");
    }
    const newJobId = randomUUID();
    this.database.prepare(`
      INSERT INTO generation_jobs (id, document_id, state)
      VALUES (?, ?, 'generating')
    `).run(newJobId, previous.documentId);
    this.launch(newJobId, (signal) => this.processSavedExtraction(newJobId, previous.documentId, extracted, signal));
    return { jobId: newJobId, documentId: previous.documentId };
  }

  cancelDocumentJobs(documentId: string): void {
    const jobs = this.database.prepare(`
      SELECT id FROM generation_jobs WHERE document_id = ? AND state IN ('extracting', 'generating', 'validating')
    `).all(documentId) as Array<{ id: string }>;
    for (const job of jobs) {
      this.active.get(job.id)?.abort(new Error("Document deleted"));
    }
  }

  private assertNoActiveJob(): void {
    if (this.active.size > 0) throw new ConflictError("GENERATION_BUSY", "Another local generation job is already running. Wait for it to finish or cancel it.");
    const active = this.database.prepare(`
      SELECT id FROM generation_jobs WHERE state IN ('extracting', 'generating', 'validating') LIMIT 1
    `).get();
    if (active) throw new ConflictError("GENERATION_BUSY", "Another local generation job is already running. Wait for it to finish or cancel it.");
  }

  private launch(jobId: string, work: (signal: AbortSignal) => Promise<void>): void {
    const controller = new AbortController();
    this.active.set(jobId, controller);
    const deadline = setTimeout(() => controller.abort(new DOMException("Job deadline exceeded", "TimeoutError")), JOB_TIMEOUT_MS);
    deadline.unref?.();
    void work(controller.signal).catch((error: unknown) => {
      if (controller.signal.aborted && controller.signal.reason instanceof Error && controller.signal.reason.name !== "TimeoutError") return;
      const apiError = controller.signal.aborted && controller.signal.reason instanceof Error && controller.signal.reason.name === "TimeoutError"
        ? new ApiError(504, "JOB_TIMEOUT", "The local generation job exceeded the 90-second total time limit.")
        : error instanceof ApiError ? error : new ApiError(500, "GENERATION_FAILED", "Question generation failed. Retry the local job.");
      const state = apiError.code === "JOB_CANCELLED" ? "cancelled" : "failed";
      this.database.prepare(`
        UPDATE generation_jobs SET state = ?, error_code = ?, error_message = ?,
          updated_at = CURRENT_TIMESTAMP, finished_at = CURRENT_TIMESTAMP
        WHERE id = ? AND state NOT IN ('ready', 'cancelled')
      `).run(state, state === "failed" ? apiError.code : null, state === "failed" ? apiError.message.slice(0, 500) : null, jobId);
    }).finally(() => {
      clearTimeout(deadline);
      this.active.delete(jobId);
    });
  }

  private async processUpload(jobId: string, documentId: string, file: UploadedDocument, signal: AbortSignal): Promise<void> {
    try {
      const extracted = await this.extractor.extract(file, documentId, signal);
      file.buffer.fill(0);
      await this.persistExtraction(jobId, documentId, extracted);
      await this.processSavedExtraction(jobId, documentId, extracted, signal);
    } finally {
      file.buffer.fill(0);
    }
  }

  private async persistExtraction(jobId: string, documentId: string, extracted: ExtractedDocument): Promise<void> {
    const transaction = this.database.transaction(() => {
      const updated = this.database.prepare(`
        UPDATE generation_jobs SET state = 'generating', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND state = 'extracting'
      `).run(jobId);
      if (updated.changes === 0) throw new ApiError(409, "JOB_CANCELLED", "The processing job was cancelled.");
      this.database.prepare(`
        UPDATE documents SET page_count = ?, normalized_chars = ?, extracted_pages_json = ?, normalized_text = ?
        WHERE id = ?
      `).run(extracted.pageCount, extracted.normalizedChars, JSON.stringify(extracted), extracted.normalizedText, documentId);
    });
    transaction();
  }

  private async processSavedExtraction(jobId: string, documentId: string, extracted: StoredPageDocument, signal: AbortSignal): Promise<void> {
    this.assertJobActive(jobId);
    const source = extracted.pages.map((page) => `PAGE ${page.pageNumber} [${page.chunkId}]\n${page.text}`).join("\n\n");
    let raw: unknown;
    try {
      raw = await this.ollama.generateQuestionSet(source, signal);
    } catch (error) {
      if (error instanceof ApiError && ["OLLAMA_INVALID_JSON", "OLLAMA_EMPTY_RESPONSE"].includes(error.code)) {
        raw = undefined;
      } else {
        throw error;
      }
    }
    this.setJobState(jobId, "validating");

    let validation = validateQuestionSet(raw, extracted.pages);
    if (validation.issues.length) {
      this.setJobState(jobId, "generating");
      const feedback = validation.issues.join("; ").slice(0, 1500);
      raw = await this.ollama.generateQuestionSet(source, signal, feedback);
      this.setJobState(jobId, "validating");
      validation = validateQuestionSet(raw, extracted.pages);
    }
    if (!validation.draft || validation.issues.length) {
      throw new ApiError(422, "QUESTION_SET_INVALID", "The local model could not produce nine valid, source-grounded questions. Retry generation or use another short PDF.");
    }

    const questionSetId = await this.commitQuestionSet(jobId, documentId, extracted, validation.draft);
    if (!questionSetId) throw new ApiError(409, "JOB_CANCELLED", "The processing job was cancelled before results were saved.");
  }

  private setJobState(jobId: string, state: JobState): void {
    const result = this.database.prepare(`
      UPDATE generation_jobs SET state = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND state IN ('extracting', 'generating', 'validating')
    `).run(state, jobId);
    if (result.changes === 0) throw new ApiError(409, "JOB_CANCELLED", "The processing job was cancelled.");
  }

  private assertJobActive(jobId: string): void {
    const job = this.database.prepare("SELECT state FROM generation_jobs WHERE id = ?").get(jobId) as { state: JobState } | undefined;
    if (!job || !["extracting", "generating", "validating"].includes(job.state)) {
      throw new ApiError(409, "JOB_CANCELLED", "The processing job was cancelled.");
    }
  }

  private async commitQuestionSet(jobId: string, documentId: string, extracted: StoredPageDocument, draft: MvpQuestionSetDraft): Promise<string | undefined> {
    const records = buildQuestionSetRecords(draft);
    const status = await this.ollama.getStatus();
    const metadata = {
      sourceSha256: (this.database.prepare("SELECT source_sha256 AS hash FROM documents WHERE id = ?").get(documentId) as { hash: string }).hash,
      model: status.model,
      modelDigest: status.digest ?? null,
      extractorVersion: EXTRACTOR_VERSION,
      promptVersion: PROMPT_VERSION,
      schemaVersion: QUESTION_SCHEMA_VERSION,
      rulesVersion: GAME_RULES_VERSION,
      pageCount: extracted.pageCount,
      normalizedChars: extracted.normalizedChars,
      tokenizerDigest: null,
      createdAt: new Date().toISOString(),
    };

    const result = this.database.transaction(() => {
      const active = this.database.prepare(`SELECT state FROM generation_jobs WHERE id = ?`).get(jobId) as { state: JobState } | undefined;
      if (!active || active.state !== "validating") return undefined;

      this.database.prepare(`
        INSERT INTO question_sets
          (id, document_id, state, model_name, model_digest, extractor_version, prompt_version, schema_version, rules_version, metadata_json)
        VALUES (?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?)
      `).run(records.questionSetId, documentId, this.ollama.model, status.digest ?? null, EXTRACTOR_VERSION, PROMPT_VERSION, QUESTION_SCHEMA_VERSION, GAME_RULES_VERSION, JSON.stringify(metadata));
      for (const topic of records.topics) {
        this.database.prepare(`INSERT INTO question_set_topics (id, question_set_id, topic_key, title, ordinal) VALUES (?, ?, ?, ?, ?)`)
          .run(topic.id, records.questionSetId, topic.key, topic.title, topic.ordinal);
      }
      for (const question of records.questions) {
        this.database.prepare(`
          INSERT INTO mvp_questions
            (id, question_set_id, topic_id, difficulty, prompt, options_json, correct_option_index, explanation, evidence_page, evidence_quote, ordinal)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(question.id, records.questionSetId, question.topicId, question.difficulty, question.prompt, JSON.stringify(question.options), question.correctOptionIndex, question.explanation, question.evidencePage, question.evidenceQuote, question.ordinal);
      }
      this.database.prepare(`
        UPDATE generation_jobs SET state = 'ready', question_set_id = ?, error_code = NULL,
          error_message = NULL, updated_at = CURRENT_TIMESTAMP, finished_at = CURRENT_TIMESTAMP
        WHERE id = ? AND state = 'validating'
      `).run(records.questionSetId, jobId);
      return records.questionSetId;
    });

    return result();
  }

  get documentExtractorVersion(): string {
    return EXTRACTOR_VERSION;
  }

  get ollamaModelName(): string {
    return this.ollama.model;
  }
}
