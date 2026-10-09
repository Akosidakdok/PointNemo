import { createHash, randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { ZodError } from "zod";
import {
  AIQuestionSetOutputSchema,
  JobStateSchema,
  QuestionSetSchema,
  type AIQuestionSetOutput,
  type GenerationJob,
  type QuestionSet,
} from "@point-nemo/shared";
import type { ApiConfig } from "../config.js";
import { BadRequestError, BusyError, NotFoundError } from "../errors.js";
import type { SqliteDatabase } from "../db.js";
import { LocalPdfExtractor, type DocumentExtractor, type ExtractedDocument, type UploadedDocument } from "./document-extractor.js";
import { OllamaService } from "./ollama.js";

interface SourceChunk {
  pageNumber: number;
  chunkId: string;
  text: string;
}

interface JobRow {
  id: string;
  document_id: string;
  state: string;
  question_set_id: string | null;
  error_code: string | null;
  started_at: string;
  finished_at: string | null;
}

interface QuestionSetRow {
  id: string;
  document_id: string;
  created_at: string;
}

function sqliteTimestampToIso(value: string): string {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Date(normalized).toISOString();
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function parseChunks(pagesJson: string): SourceChunk[] {
  let value: unknown;
  try {
    value = JSON.parse(pagesJson);
  } catch {
    throw new BadRequestError("INVALID_SOURCE", "Extracted source text is not readable.");
  }
  if (!Array.isArray(value)) {
    throw new BadRequestError("INVALID_SOURCE", "Extracted source text has an invalid shape.");
  }
  return value.map((chunk) => {
    if (!chunk || typeof chunk !== "object") {
      throw new BadRequestError("INVALID_SOURCE", "Extracted source text has an invalid chunk.");
    }
    const candidate = chunk as Record<string, unknown>;
    if (
      typeof candidate.pageNumber !== "number" ||
      typeof candidate.chunkId !== "string" ||
      typeof candidate.text !== "string"
    ) {
      throw new BadRequestError("INVALID_SOURCE", "Extracted source text is missing page or chunk metadata.");
    }
    return {
      pageNumber: candidate.pageNumber,
      chunkId: candidate.chunkId,
      text: candidate.text,
    };
  });
}

function validateGeneratedOutput(output: unknown, pagesJson: string): AIQuestionSetOutput {
  const parsed = AIQuestionSetOutputSchema.parse(output);
  const pages = parseChunks(pagesJson);
  const topicNames = new Set<string>();
  for (const topic of parsed.topics) {
    const key = normalizedName(topic.name);
    if (!key || topicNames.has(key)) {
      throw new BadRequestError("INVALID_MODEL_OUTPUT", "The model returned duplicate or empty topics.");
    }
    topicNames.add(key);
  }

  const coverage = new Set<string>();
  for (const question of parsed.questions) {
    const topicKey = normalizedName(question.topicName);
    if (!topicNames.has(topicKey)) {
      throw new BadRequestError("INVALID_MODEL_OUTPUT", "A question references a topic outside the generated set.");
    }

    const coverageKey = `${topicKey}:${question.difficulty}`;
    if (coverage.has(coverageKey)) {
      throw new BadRequestError("INVALID_MODEL_OUTPUT", "The model returned duplicate topic and difficulty coverage.");
    }
    coverage.add(coverageKey);

    const options = question.options.map((option) => normalizedName(option));
    if (new Set(options).size !== options.length) {
      throw new BadRequestError("INVALID_MODEL_OUTPUT", "The model returned duplicate answer options.");
    }

    for (const evidence of question.evidence) {
      const chunk = pages.find((candidate) => candidate.chunkId === evidence.chunkId);
      if (!chunk || chunk.pageNumber !== evidence.pageNumber || !chunk.text.includes(evidence.quote.trim())) {
        throw new BadRequestError("SOURCE_EVIDENCE_INVALID", "A generated evidence quote was not found in its source chunk.");
      }
    }
  }

  if (coverage.size !== 9 || parsed.topics.some((topic) => !["easy", "medium", "hard"].every((difficulty) => coverage.has(`${normalizedName(topic.name)}:${difficulty}`)))) {
    throw new BadRequestError("INVALID_MODEL_OUTPUT", "The model did not return one easy, medium, and hard question for each topic.");
  }
  return parsed;
}

function sourcePrompt(extracted: ExtractedDocument): string {
  return parseChunks(extracted.pagesJson)
    .map((chunk) => `[Page ${chunk.pageNumber} | ${chunk.chunkId}]\n${chunk.text}`)
    .join("\n\n");
}

export class GenerationJobService {
  private activeJobId: string | null = null;

  constructor(
    private readonly database: SqliteDatabase,
    private readonly config: ApiConfig,
    private readonly extractor: DocumentExtractor = new LocalPdfExtractor(),
    private readonly ollama: OllamaService = new OllamaService(config),
  ) {}

  async enqueue(file: UploadedDocument): Promise<{ documentId: string; jobId: string }> {
    if (this.activeJobId) {
      throw new BusyError("GENERATION_BUSY", "Another document is being processed. Wait for it to finish before uploading again.");
    }

    const documentId = randomUUID();
    const jobId = randomUUID();
    this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO documents (id, filename, sha256, page_count, normalized_char_count, pages_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(documentId, file.originalName.slice(0, 255), `pending-${documentId}`, 1, 0, "[]");
      this.database.prepare(`
        INSERT INTO generation_jobs (id, document_id, state)
        VALUES (?, ?, 'extracting')
      `).run(jobId, documentId);
    })();

    this.activeJobId = jobId;
    void this.run(jobId, documentId, file).finally(() => {
      if (this.activeJobId === jobId) this.activeJobId = null;
    });
    return { documentId, jobId };
  }

  getJob(id: string): GenerationJob {
    const row = this.database.prepare(`
      SELECT id, document_id, state, question_set_id, error_code, started_at, finished_at
      FROM generation_jobs WHERE id = ?
    `).get(id) as JobRow | undefined;
    if (!row) throw new NotFoundError("JOB_NOT_FOUND", "Generation job was not found.");

    const start = new Date(sqliteTimestampToIso(row.started_at)).getTime();
    const finish = row.finished_at ? new Date(sqliteTimestampToIso(row.finished_at)).getTime() : Date.now();
    return {
      id: row.id,
      documentId: row.document_id,
      state: JobStateSchema.parse(row.state),
      questionSetId: row.question_set_id ?? undefined,
      errorCode: row.error_code ?? undefined,
      elapsedTimeMs: Math.max(0, finish - start),
      createdAt: sqliteTimestampToIso(row.started_at),
    };
  }

  getQuestionSet(id: string): QuestionSet {
    const set = this.database.prepare(`
      SELECT id, document_id, created_at FROM question_sets WHERE id = ?
    `).get(id) as QuestionSetRow | undefined;
    if (!set) throw new NotFoundError("QUESTION_SET_NOT_FOUND", "Question set was not found.");

    const topics = this.database.prepare(`
      SELECT id, name FROM topics_p0 WHERE question_set_id = ? ORDER BY rowid
    `).all(id) as Array<{ id: string; name: string }>;
    const questions = this.database.prepare(`
      SELECT id, topic_id, difficulty, prompt, options_json, answer_index, explanation, evidence_json
      FROM questions_p0 WHERE question_set_id = ? ORDER BY rowid
    `).all(id) as Array<{
      id: string;
      topic_id: string;
      difficulty: "easy" | "medium" | "hard";
      prompt: string;
      options_json: string;
      answer_index: number;
      explanation: string;
      evidence_json: string;
    }>;

    return QuestionSetSchema.parse({
      id: set.id,
      documentId: set.document_id,
      topics,
      questions: questions.map((question) => ({
        id: question.id,
        topicId: question.topic_id,
        difficulty: question.difficulty,
        prompt: question.prompt,
        options: JSON.parse(question.options_json),
        answerIndex: question.answer_index,
        explanation: question.explanation,
        evidence: JSON.parse(question.evidence_json),
      })),
      createdAt: sqliteTimestampToIso(set.created_at),
    });
  }

  private async run(jobId: string, documentId: string, file: UploadedDocument): Promise<void> {
    try {
      const extracted = await this.withJobTimeout(this.extractor.extractText(file));
      this.database.prepare(`
        UPDATE documents
        SET sha256 = ?, page_count = ?, normalized_char_count = ?, pages_json = ?
        WHERE id = ?
      `).run(extracted.sha256, extracted.pageCount, extracted.normalizedCharCount, extracted.pagesJson, documentId);
      this.setJobState(jobId, "generating");

      const output = await this.withJobTimeout(this.ollama.generateQuestions(sourcePrompt(extracted)));
      this.setJobState(jobId, "validating");
      const validated = validateGeneratedOutput(output, extracted.pagesJson);
      const questionSetId = this.persistQuestionSet(documentId, jobId, validated);
      this.database.prepare(`
        UPDATE generation_jobs SET state = 'ready', question_set_id = ?, finished_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(questionSetId, jobId);
    } catch (error) {
      const errorCode = error instanceof ZodError
        ? "INVALID_MODEL_OUTPUT"
        : error instanceof Error && "code" in error && typeof error.code === "string"
          ? error.code
          : error instanceof Error && error.message === "JOB_TIMEOUT"
            ? "JOB_TIMEOUT"
            : "GENERATION_FAILED";
      this.database.prepare(`
        UPDATE generation_jobs SET state = 'failed', error_code = ?, finished_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(errorCode, jobId);
    }
  }

  private setJobState(jobId: string, state: "extracting" | "generating" | "validating"): void {
    this.database.prepare("UPDATE generation_jobs SET state = ? WHERE id = ?").run(state, jobId);
  }

  private persistQuestionSet(documentId: string, jobId: string, output: AIQuestionSetOutput): string {
    const questionSetId = randomUUID();
    const topicIds = new Map<string, string>();
    for (const topic of output.topics) topicIds.set(normalizedName(topic.name), randomUUID());
    const settingsHash = createHash("sha256").update(JSON.stringify({
      model: this.config.ollamaModel,
      context: this.config.ollamaNumCtx,
      maxOutput: this.config.ollamaMaxOutputTokens,
    })).digest("hex");

    this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO question_sets (id, document_id, model_tag, model_digest, settings_hash)
        VALUES (?, ?, ?, ?, ?)
      `).run(questionSetId, documentId, this.config.ollamaModel, "unknown", settingsHash);
      const insertTopic = this.database.prepare(`
        INSERT INTO topics_p0 (id, question_set_id, name) VALUES (?, ?, ?)
      `);
      for (const topic of output.topics) insertTopic.run(topicIds.get(normalizedName(topic.name)), questionSetId, topic.name.trim());

      const insertQuestion = this.database.prepare(`
        INSERT INTO questions_p0
          (id, question_set_id, topic_id, difficulty, prompt, options_json, answer_index, explanation, evidence_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const question of output.questions) {
        insertQuestion.run(
          randomUUID(),
          questionSetId,
          topicIds.get(normalizedName(question.topicName)),
          question.difficulty,
          question.prompt.trim(),
          JSON.stringify(question.options.map((option) => option.trim())),
          question.answerIndex,
          question.explanation.trim(),
          JSON.stringify(question.evidence),
        );
      }
      this.database.prepare("UPDATE generation_jobs SET question_set_id = ? WHERE id = ?").run(questionSetId, jobId);
    })();
    return questionSetId;
  }

  private async withJobTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("JOB_TIMEOUT")), this.config.jobTimeoutMs);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}
