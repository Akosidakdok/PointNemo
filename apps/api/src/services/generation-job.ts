import { createHash, randomInt, randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { AIQuestionSetOutputSchema, BackendQuestionSetSchema, JobStateSchema,
  type AIQuestionSetOutput, type BackendQuestionSet, type GenerationJob, type GenerationMetadata, type LibraryDocument } from "@point-nemo/shared";
import type { ApiConfig } from "../config.js";
import { ApiError, BadRequestError, BusyError, ConflictError, NotFoundError, ServiceUnavailableError } from "../errors.js";
import type { SqliteDatabase } from "../db.js";
import { admitPdf, LocalPdfExtractor, type DocumentExtractor, type ExtractedDocument, type UploadedDocument } from "./document-extractor.js";
import { OllamaService, generationMessages } from "./ollama.js";
import { EXTRACTOR_VERSION, generationMetadata, isCompatibleMetadata, isPlayableMetadata } from "./generation-metadata.js";
import { parseChunks, selectPassages, resolveEvidence, formatPassages } from "./source-selection.js";
import { inspectQuestions, mergeRepair, requireQuestionQuality, parseQuestionPlan, type RepairPlan, type QuestionPlan } from "./question-quality.js";
import { checkTokenBudget, localTokenizer, tokenizerStatus, type TokenCounter } from "./token-budget.js";
import { GameRunService } from "./game-run.js";

interface JobRow { id: string; document_id: string; state: string; question_set_id: string | null; error_code: string | null;
  error_message: string | null; error_stage: "extracting" | "generating" | "validating" | null; started_at: string; finished_at: string | null;
  cancel_requested: number; retry_count: number; timings_json: string; phase: GenerationJob["phase"] }
interface SetRow { id: string; document_id: string; created_at: string; model_tag: string; model_digest: string; settings_hash: string;
  document_hash: string; extractor_version: string; prompt_version: string; schema_version: string; tokenizer_digest: string; filename: string; pages_json: string; sha256: string }

export function sqliteTimestampToIso(value: string): string {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`).toISOString();
}
export { requireQuestionQuality as validateGeneratedOutput } from "./question-quality.js";
function key(value: string): string { return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase(); }
function focusKey(value: string): string { return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim(); }

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

  constructor(private readonly database: SqliteDatabase, private readonly config: ApiConfig,
    private readonly extractor: DocumentExtractor = new LocalPdfExtractor(), private readonly ollama: OllamaService = new OllamaService(config),
    private readonly tokenCounter?: TokenCounter) {
    this.database.prepare(`UPDATE generation_jobs SET error_stage = state, state = 'failed', error_code = 'INTERRUPTED_JOB',
      error_message = 'The app stopped before this job finished. Upload again to retry.', finished_at = ?
      WHERE state IN ('extracting','generating','validating')`).run(new Date().toISOString());
  }

  async enqueue(file: UploadedDocument, reuseSaved = false): Promise<{ documentId: string; jobId: string; reused?: boolean; savedAt?: string }> {
    admitPdf(file);
    if (this.activeJobId) throw new BusyError("GENERATION_BUSY", "Another document is being processed. Cancel it or wait before uploading.");
    const hash = createHash("sha256").update(file.buffer).digest("hex");
    if (reuseSaved) {
      const status = await this.ollama.getStatus();
      if (this.activeJobId) throw new BusyError("GENERATION_BUSY", "Another document is being processed. Wait before uploading.");
      const candidates = this.database.prepare(`SELECT q.id,j.id AS job_id,q.document_id FROM question_sets q
        JOIN documents d ON d.id=q.document_id JOIN generation_jobs j ON j.question_set_id=q.id
        WHERE d.sha256=? AND j.state='ready' ORDER BY q.created_at DESC`).all(hash) as Array<{id:string;job_id:string;document_id:string}>;
      for (const candidate of candidates) {
        const saved = this.getQuestionSet(candidate.id);
        if (saved.metadata && isCompatibleMetadata(saved.metadata, this.config, status.digest ?? "", this.tokenCounter?.digest ?? tokenizerStatus().digest ?? "")) {
          file.buffer = Buffer.alloc(0);
          return { documentId: candidate.document_id, jobId: candidate.job_id, reused: true, savedAt: saved.createdAt };
        }
      }
    }
    const documentId = randomUUID(), jobId = randomUUID(), createdAt = new Date().toISOString();
    this.database.transaction(() => {
      this.database.prepare("INSERT INTO documents (id,filename,sha256,page_count,normalized_char_count,pages_json,created_at) VALUES (?,?,?,1,0,'[]',?)")
        .run(documentId, file.originalName.replace(/^.*[\\/]/, "").slice(0, 255), hash, createdAt);
      this.database.prepare("INSERT INTO generation_jobs (id,document_id,state,started_at) VALUES (?,?,'extracting',?)").run(jobId, documentId, createdAt);
    })();
    this.activeJobId = jobId;
    const controller = new AbortController(); this.controllers.set(jobId, controller);
    void this.run(jobId, documentId, file, controller, hash).finally(() => {
      this.controllers.delete(jobId); if (this.activeJobId === jobId) this.activeJobId = null;
    });
    return { documentId, jobId };
  }

  async retryDocument(documentId: string): Promise<{ documentId: string; jobId: string }> {
    if (this.activeJobId) throw new BusyError("GENERATION_BUSY", "Another document is being processed. Cancel it or wait.");
    const document = this.database.prepare("SELECT * FROM documents WHERE id=?").get(documentId) as
      { filename:string;sha256:string;page_count:number;normalized_char_count:number;pages_json:string;extractor_version:string } | undefined;
    if (!document) throw new NotFoundError("DOCUMENT_NOT_FOUND", "Saved source was not found.");
    if (document.extractor_version !== EXTRACTOR_VERSION || !parseChunks(document.pages_json).length) throw new BadRequestError("REUPLOAD_REQUIRED", "Select the PDF again so its text can be extracted with the current version.");
    const jobId = randomUUID();
    this.database.prepare("INSERT INTO generation_jobs(id,document_id,state,started_at,phase) VALUES (?,?,'extracting',?,'selecting')").run(jobId,documentId,new Date().toISOString());
    this.activeJobId = jobId;
    const controller = new AbortController(); this.controllers.set(jobId, controller);
    const extracted = { sha256: document.sha256, pageCount: document.page_count, normalizedCharCount: document.normalized_char_count, pagesJson: document.pages_json };
    void this.run(jobId, documentId, { originalName: document.filename, mimeType:"application/pdf",buffer:Buffer.alloc(0) }, controller, document.sha256, extracted).finally(() => {
      this.controllers.delete(jobId); if (this.activeJobId === jobId) this.activeJobId = null;
    });
    return { documentId, jobId };
  }

  getJob(id: string): GenerationJob {
    const row = this.database.prepare("SELECT * FROM generation_jobs WHERE id=?").get(id) as JobRow | undefined;
    if (!row) throw new NotFoundError("JOB_NOT_FOUND", "Generation job was not found.");
    const start = Date.parse(sqliteTimestampToIso(row.started_at)), finish = row.finished_at ? Date.parse(sqliteTimestampToIso(row.finished_at)) : Date.now();
    const source = this.database.prepare("SELECT extractor_version FROM documents WHERE id=?").get(row.document_id) as {extractor_version:string} | undefined;
    return { id: row.id, documentId: row.document_id, state: JobStateSchema.parse(row.state), phase: ["ready", "failed", "cancelled"].includes(row.state) ? row.state as GenerationJob["phase"] : row.phase ?? undefined,
      canRetry: row.state === "failed" && source?.extractor_version === EXTRACTOR_VERSION, questionSetId: row.question_set_id ?? undefined,
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
    return BackendQuestionSetSchema.parse({ id: row.id, documentId: row.document_id, filename: row.filename, topics, extractedPages: parseChunks(row.pages_json), metadata,
      compatible: isPlayableMetadata(metadata, row.sha256),
      questions: rows.map((q) => ({id:q.id,topicId:q.topic_id,difficulty:q.difficulty,prompt:q.prompt,options:JSON.parse(q.options_json),answerIndex:q.answer_index,explanation:q.explanation,evidence:JSON.parse(q.evidence_json)})),
      createdAt: sqliteTimestampToIso(row.created_at) });
  }

  async requireCompatibleQuestionSet(id: string): Promise<void> {
    if (!this.getQuestionSet(id).compatible) throw new ConflictError("INCOMPATIBLE_SAVED_SET", "These saved questions use a different source or runtime version. Upload the document for fresh generation.");
  }

  async listDocuments(): Promise<LibraryDocument[]> {
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

  private async run(jobId: string, documentId: string, file: UploadedDocument, controller: AbortController, documentHash: string, savedSource?: ExtractedDocument): Promise<void> {
    const start = Date.now(), deadline = start + this.config.jobTimeoutMs, signal = controller.signal;
    const timer = setTimeout(() => controller.abort(new ServiceUnavailableError("JOB_TIMEOUT", "The complete generation job exceeded its deadline. Export a smaller excerpt and retry.")), this.config.jobTimeoutMs);
    const timings: Record<string, number> = {};
    const phase = (value: GenerationJob["phase"]): void => {
      this.checkActive(jobId, signal, deadline);
      this.database.prepare("UPDATE generation_jobs SET phase=?,timings_json=? WHERE id=?").run(value, JSON.stringify(timings), jobId);
    };
    let stage: "extracting" | "generating" | "validating" = "extracting";
    let stageStart = start;
    const transition = (next: typeof stage) => {
      this.checkActive(jobId, signal, deadline); stage = next; stageStart = Date.now();
      this.database.prepare("UPDATE generation_jobs SET state=? WHERE id=?").run(next, jobId);
    };
    try {
      phase(savedSource ? "selecting" : "reading");
      const extracted = savedSource ?? await abortable(this.extractor.extractText(file, signal), signal);
      this.checkActive(jobId, signal, deadline); timings.extractionMs = Date.now() - stageStart;
      // Raw PDFs are never retained. Only normalized pages and the original byte hash remain.
      file.buffer = Buffer.alloc(0); timings.sourceReused = savedSource ? 1 : 0;
      this.database.prepare("UPDATE documents SET page_count=?,normalized_char_count=?,pages_json=?,extractor_version=? WHERE id=?")
        .run(extracted.pageCount, extracted.normalizedCharCount, extracted.pagesJson, EXTRACTOR_VERSION, documentId);
      transition("generating");
      phase("selecting");
      const status = await abortable(this.ollama.getStatus(signal), signal);
      this.checkActive(jobId, signal, deadline);
      if (!status.available || !status.digest) throw new ServiceUnavailableError("OLLAMA_UNAVAILABLE", status.message);
      const counter = this.tokenCounter ?? localTokenizer();
      const allChunks = parseChunks(extracted.pagesJson);
      const selectionStart = Date.now();
      const selection = selectPassages(allChunks, (source) => counter.count(generationMessages(source).map((m) => m.content).join("\n")) + 32 <= this.config.ollamaMaxInputTokens - 512);
      const { source, passages } = selection;
      timings.selectionMs = Date.now() - selectionStart;
      timings.totalPassages = selection.totalPassages; timings.selectedPassages = passages.length;
      timings.selectedPages = new Set(passages.map((p) => p.pageNumber)).size; timings.totalPages = allChunks.length;
      // A PDF retry must not recreate the same deterministic failed question set.
      const generationSeed = this.config.generationSeed ?? randomInt(1, 2_000_000_000);
      timings.seed = generationSeed;
      let feedback: string | undefined, validated: AIQuestionSetOutput | undefined, repair: RepairPlan | undefined, plan: QuestionPlan | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        this.checkActive(jobId, signal, deadline);
        phase(attempt ? "repairing" : "creating");
        let attemptSource = source;
        // Repair context consumes tokens too. Remove complete passages as needed;
        // never truncate a cited passage or the list of retained questions.
        const repairPassages = [...passages];
        while (attempt && !(repair && plan) && counter.count(generationMessages(attemptSource, feedback, repair).map((m) => m.content).join("\n")) + 32 > this.config.ollamaMaxInputTokens && repairPassages.length > 1) {
          repairPassages.pop(); attemptSource = repairPassages.map((p) => `[${p.id} | page ${p.pageNumber}] ${p.text}`).join("\n");
        }
        if (attempt && repair && plan) timings.repairInputTokens = 0;
        else timings[attempt ? "repairInputTokens" : "inputTokens"] = checkTokenBudget(generationMessages(attemptSource, feedback, repair), this.config.ollamaMaxInputTokens, counter);
        const inferenceStart = Date.now();
        let inferenceRecorded = false;
        const attemptSignal = AbortSignal.any([signal, AbortSignal.timeout(this.config.inferenceTimeoutMs)]);
        try {
          const recordMetrics = (prefix: string, metrics: Record<string,number>): void => {
            for (const [name,value] of Object.entries(metrics)) if(name!=="tokensPerSecond") timings[`${prefix}_${name}`] = (timings[`${prefix}_${name}`] ?? 0)+value;
            const duration = timings[`${prefix}_eval_duration`], count = timings[`${prefix}_eval_count`];
            if (duration && count) timings[`${prefix}_tokensPerSecond`] = count/(duration/1e9);
          };
          let output: unknown;
          if (repair && plan) {
            let currentQuestions = [...repair.questions];
            const passageIdsByCitation = new Map(passages.map((passage) => [
              JSON.stringify([passage.pageNumber, passage.chunkId, passage.text]), passage.id,
            ]));
            for (const [repairIndex, slot] of repair.slots.entries()) {
              this.checkActive(jobId, signal, deadline);
              const objective = plan.slots.find((planned) => planned.index === slot.index);
              if (!objective) throw new BadRequestError("INVALID_MODEL_OUTPUT", "The repair has no planned learning objective.");
              const plannedPassage = passages.find((passage)=>passage.id===objective.evidenceId);
              if (!plannedPassage) throw new BadRequestError("INVALID_SOURCE", "The planned source passage is missing.");
              const topicObjectives = plan.slots.filter((planned)=>planned.topicName===objective.topicName);
              const topicPages = new Set(passages.filter((passage)=>topicObjectives.some((planned)=>planned.evidenceId===passage.id)).map((passage)=>passage.pageNumber));
              const topicPassages = passages.filter((passage)=>topicPages.has(passage.pageNumber));
              const pendingSlots = new Set(repair.slots.slice(repairIndex).map((pending)=>pending.index));
              const retainedIds = new Set(currentQuestions.flatMap((question:any,index)=>pendingSlots.has(index) ? [] :
                (question.evidence ?? []).flatMap((item:any)=>{const id=passageIdsByCitation.get(JSON.stringify([item.pageNumber,item.chunkId,item.quote]));return id?[id]:[];})));
              const distractorsOnly = slot.problems.every((problem)=>problem==="All four answer options must be distinct." || problem.includes("[answer_choices]"));
              const needsDifferentFact = slot.problems.some((problem)=>problem.includes("repeats question") || problem.includes("[duplicate_fact]"));
              const retainedFocusFacts = new Set([...retainedIds].map((id)=>{
                const passage = passages.find((item)=>item.id===id);
                return passage ? focusKey(passage.focus ?? passage.text) : "";
              }).filter(Boolean));
              const otherPlannedIds = new Set(plan.slots.filter((planned)=>planned.index!==slot.index).map((planned)=>planned.evidenceId));
              const alternativePassage = needsDifferentFact ? topicPassages.find((passage)=>
                passage.id!==objective.evidenceId && !otherPlannedIds.has(passage.id) && !retainedIds.has(passage.id) &&
                focusKey(passage.focus ?? passage.text)!==focusKey(plannedPassage.focus ?? plannedPassage.text) &&
                !retainedFocusFacts.has(focusKey(passage.focus ?? passage.text))) : undefined;
              if (needsDifferentFact && !alternativePassage) throw new BadRequestError("INSUFFICIENT_SOURCE","The PDF does not have another unused fact for this topic. Select a larger or more detailed text section.");
              const repairPassage = alternativePassage ?? plannedPassage;
              const focusedSlot = {...slot,goal:repairPassage.focus ?? repairPassage.text,evidenceId:repairPassage.id,
                allowedEvidenceIds:[repairPassage.id],distractorsOnly};
              const slotPlan: RepairPlan = { topics: repair.topics, questions: currentQuestions, slots: [focusedSlot],
                excludedSlots:repair.slots.slice(repairIndex).map((pending)=>pending.index) };
              const slotFeedback = slot.problems.join(" ");
              const requiredPassages = new Set([repairPassage.id]);
              let repairSourcePassages = [repairPassage];
              const fitsRepairContext = (candidatePassages: typeof passages): boolean => {
                const candidateSource = formatPassages(candidatePassages);
                const messages = generationMessages(candidateSource, slotFeedback, slotPlan);
                return counter.count(messages.map((message) => message.content).join("\n")) + 32 <= this.config.ollamaMaxInputTokens;
              };
              if (!repairSourcePassages.length || !fitsRepairContext(repairSourcePassages)) {
                throw new BadRequestError("TOKEN_OVERFLOW", "The saved source passages and passing questions do not fit together for a safe repair. Select a shorter PDF excerpt.");
              }
              for (const passage of topicPassages) {
                if (distractorsOnly || !needsDifferentFact) break;
                if (requiredPassages.has(passage.id)) continue;
                const expanded = [...repairSourcePassages, passage];
                if (fitsRepairContext(expanded)) repairSourcePassages = expanded;
              }
              const repairSource = formatPassages(repairSourcePassages);
              const repairMessages = generationMessages(repairSource, slotFeedback, slotPlan);
              timings.repairInputTokens += checkTokenBudget(repairMessages, this.config.ollamaMaxInputTokens, counter);
              const slotSignal = attemptSignal;
              for (let candidateAttempt = 0; candidateAttempt < (distractorsOnly ? 2 : 1); candidateAttempt++) {
              const replacement = await abortable(this.ollama.generateQuestions(repairSource, {
                signal: slotSignal, repairFeedback: candidateAttempt ? `${slotFeedback} Your previous choices still duplicated or contained the correct answer. Write three different WRONG answers.` : slotFeedback, repair: slotPlan,
                seed: (generationSeed + 100 + slot.index + candidateAttempt*1000) % 2_000_000_000,
                onMetrics: (metrics) => recordMetrics("repair", metrics),
              }), slotSignal).catch((error: unknown) => {
                if (signal.aborted) throw signal.reason;
                if (slotSignal.aborted) throw new ServiceUnavailableError("INFERENCE_TIMEOUT", "Local inference timed out while improving a question.");
                throw error;
              });
              const proposedQuestions = (resolveEvidence(mergeRepair(slotPlan, replacement), passages) as { questions: unknown[] }).questions;
              const choiceIssues = distractorsOnly ? inspectQuestions({status:"ready",topics:repair.topics,questions:proposedQuestions},extracted.pagesJson).issues
                .filter((issue)=>issue.index===slot.index && (issue.message==="All four answer options must be distinct." || issue.message.includes("[answer_choices]"))) : [];
              if (choiceIssues.length) {
                if (candidateAttempt === 0) continue;
                throw new BadRequestError("INVALID_MODEL_OUTPUT","The model repeated or overlapped answer options after the bounded distractor repair.");
              }
              currentQuestions = proposedQuestions;
              break;
              }
              timings.repairedQuestionsCompleted = repairIndex + 1;
              phase("repairing");
            }
            output = { status: "ready", topics: repair.topics, questions: currentQuestions };
            repair = undefined;
          } else if (!repair && typeof this.ollama.planQuestions === "function") {
            if (!plan) {
              phase("selecting");
              const proposed = await abortable(this.ollama.planQuestions(attemptSource, {signal:attemptSignal,repairFeedback:feedback,seed:generationSeed+attempt,onMetrics:(metrics)=>recordMetrics("plan",metrics)}),attemptSignal);
              plan = parseQuestionPlan(proposed,new Set(passages.map((p)=>p.id)),new Map(passages.map((passage)=>[passage.id,passage.focus ?? passage.text])));
            }
            phase("creating");
            const questions: Record<string,unknown> = {};
            timings.createdQuestions = 0;
            for (const plannedSlot of plan.slots) {
              this.checkActive(jobId,signal,deadline);
              const slots = [plannedSlot.index];
              const ids = new Set(plan.slots.filter((slot)=>slots.includes(slot.index)).map((slot)=>slot.evidenceId));
              const topicPassages = passages.filter((p)=>ids.has(p.id));
              const topicSource = formatPassages(topicPassages);
              checkTokenBudget(generationMessages(topicSource,feedback,undefined,plan,slots),this.config.ollamaMaxInputTokens,counter);
              const batch = await abortable(this.ollama.generateQuestions(topicSource,{signal:attemptSignal,plan,slots,maxOutputTokens:768,seed:generationSeed+plannedSlot.index+attempt,
                onMetrics:(metrics)=>recordMetrics(attempt?"repair":"initial",metrics)}),attemptSignal) as any;
              if (!batch?.questions || Array.isArray(batch.questions) || Object.keys(batch.questions).length!==1 || !slots.every((slot)=>Object.hasOwn(batch.questions,String(slot)))) {
                throw new BadRequestError("INVALID_MODEL_OUTPUT","The model did not return the requested question slot.");
              }
              Object.assign(questions,batch.questions); timings.createdQuestions++; phase("creating");
            }
            output = {status:"ready",topics:plan.topics,questions};
          } else {
            output = await abortable(this.ollama.generateQuestions(attemptSource, { signal: attemptSignal, repairFeedback: feedback, repair, seed: generationSeed + attempt,
              onMetrics: (metrics) => recordMetrics(attempt ? "repair" : "initial",metrics),
            }), attemptSignal);
          }
          timings.generationMs = (timings.generationMs ?? 0) + Date.now() - inferenceStart;
          inferenceRecorded = true;
          transition("validating"); phase("checking");
          const candidate = resolveEvidence(repair ? mergeRepair(repair, output) : output, attempt ? repairPassages : passages);
          const validationStart = Date.now();
          const report = inspectQuestions(candidate, extracted.pagesJson);
          if (this.config.reviewEnabled && AIQuestionSetOutputSchema.safeParse(candidate).success && typeof this.ollama.reviewQuestions === "function") {
            const review = await abortable(this.ollama.reviewQuestions((candidate as AIQuestionSetOutput).questions,{
              signal:attemptSignal,seed:generationSeed+attempt,onMetrics:(metrics)=>recordMetrics("review",metrics),
            }),attemptSignal) as {issues?:Array<{slot:number;reason:string;kind:string}>};
            const reviewIssues = review?.issues;
            if (!Array.isArray(reviewIssues) || reviewIssues.some((issue)=>!Number.isInteger(issue.slot) || issue.slot<0 || issue.slot>8 || typeof issue.reason!=="string" || !issue.reason.trim() || !["answer_support","answer_choices","duplicate_fact","difficulty"].includes(issue.kind))) {
              throw new BadRequestError("INVALID_MODEL_OUTPUT","The question review returned invalid feedback.");
            }
            if (reviewIssues.length) {
              const draft = candidate as AIQuestionSetOutput;
              report.issues.push(...reviewIssues.map((issue)=>({index:issue.slot,code:"SOURCE_EVIDENCE_INVALID",message:`Question ${issue.slot+1} [${issue.kind}]: ${issue.reason}`})));
              report.repair = {topics:draft.topics,questions:draft.questions,slots:[...new Set(report.issues.map((issue)=>issue.index))].map((index)=>({
                index,topicName:draft.questions[index]!.topicName,difficulty:draft.questions[index]!.difficulty,
                problems:report.issues.filter((issue)=>issue.index===index).map((issue)=>issue.message),
              }))};
            }
          }
          timings.validationMs = (timings.validationMs ?? 0) + Date.now() - validationStart;
          if (report.issues.length) {
            repair = report.repair;
            timings.repairedQuestions = repair?.slots.length ?? 9;
            const first = report.issues[0]!;
            throw new BadRequestError(first.code, report.issues.map((issue) => issue.message).join(" ").slice(0, 1200));
          }
          validated = requireQuestionQuality(candidate, extracted.pagesJson);
          break;
        } catch (error) {
          if (!inferenceRecorded) timings.generationMs = (timings.generationMs ?? 0) + Date.now() - inferenceStart;
          if (signal.aborted) throw signal.reason;
          if (attemptSignal.aborted) throw new ServiceUnavailableError("INFERENCE_TIMEOUT", "Local inference exceeded its deadline. Retry or use a smaller excerpt.");
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
      this.database.prepare("UPDATE generation_jobs SET phase='ready' WHERE id=? AND state='ready'").run(jobId);
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
