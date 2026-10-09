import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { AIQuestionSetOutput } from "@point-nemo/shared";
import { initializeDatabase } from "../src/db.js";
import { GenerationJobService } from "../src/services/generation-job.js";
import { LocalPdfExtractor, type DocumentExtractor, type ExtractedDocument, type UploadedDocument } from "../src/services/document-extractor.js";
import type { ApiConfig } from "../src/config.js";
import type { OllamaService } from "../src/services/ollama.js";

const config: ApiConfig = {
  port: 3001,
  databasePath: "",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "test-model",
  ollamaNumCtx: 8192,
  ollamaMaxInputTokens: 4096,
  ollamaMaxOutputTokens: 3072,
  inferenceTimeoutMs: 1_000,
  jobTimeoutMs: 2_000,
};

const sourceQuote = "IPv4 uses 32 bits and IPv6 uses 128 bits for routing data packets.";
const source: ExtractedDocument = {
  sha256: "fixture-hash",
  pageCount: 1,
  normalizedCharCount: sourceQuote.length,
  pagesJson: JSON.stringify([{ pageNumber: 1, chunkId: "chunk-1", text: sourceQuote }]),
};

function validOutput(): AIQuestionSetOutput {
  const topics = ["IP Addressing", "DNS", "HTTP"];
  const questions = topics.flatMap((topicName) => (["easy", "medium", "hard"] as const).map((difficulty, index) => ({
    topicName,
    difficulty,
    prompt: `${topicName} question ${difficulty}?`,
    options: [`Correct ${index}`, "Alternative one", "Alternative two", "Alternative three"],
    answerIndex: 0,
    explanation: "The source text supports the selected answer.",
    evidence: [{ pageNumber: 1, chunkId: "chunk-1", quote: sourceQuote }],
  })));
  return { topics: topics.map((name) => ({ name })), questions };
}

function mockExtractor(result: ExtractedDocument): DocumentExtractor {
  return { extractText: async (_file: UploadedDocument) => result };
}

function mockOllama(output: unknown): OllamaService {
  return {
    generateQuestions: async (_input: string) => output as AIQuestionSetOutput,
    getStatus: async () => ({ available: true, model: config.ollamaModel, message: "ready" }),
  } as OllamaService;
}

async function waitForTerminal(service: GenerationJobService, jobId: string): Promise<ReturnType<GenerationJobService["getJob"]>> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const job = service.getJob(jobId);
    if (["ready", "failed", "cancelled"].includes(job.state)) return job;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Job did not reach a terminal state in time.");
}

async function withDatabase<T>(callback: (databasePath: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "point-nemo-api-"));
  try {
    return await callback(join(directory, "test.sqlite"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("LocalPdfExtractor admits the networking fixture", async () => {
  const fixturePath = fileURLToPath(new URL("../../../fixtures/networking-demo.pdf", import.meta.url));
  const buffer = await readFile(fixturePath);
  const extracted = await new LocalPdfExtractor().extractText({
    originalName: "networking-demo.pdf",
    mimeType: "application/pdf",
    buffer,
  });
  assert.equal(extracted.pageCount, 1);
  assert.ok(extracted.normalizedCharCount >= 300);
  assert.match(extracted.sha256, /^[a-f0-9]{64}$/);
});

test("valid model output is persisted as one complete question set", async () => {
  await withDatabase(async (databasePath) => {
    const database = initializeDatabase(databasePath);
    try {
      const service = new GenerationJobService(database, config, mockExtractor(source), mockOllama(validOutput()));
      const result = await service.enqueue({ originalName: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("pdf") });
      const job = await waitForTerminal(service, result.jobId);
      assert.equal(job.state, "ready");
      assert.ok(job.questionSetId);
      const questionSet = service.getQuestionSet(job.questionSetId!);
      assert.equal(questionSet.topics.length, 3);
      assert.equal(questionSet.questions.length, 9);
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM question_sets").get().count, 1);
    } finally {
      database.close();
    }
  });
});

test("invalid model output fails closed without persisting a question set", async () => {
  await withDatabase(async (databasePath) => {
    const database = initializeDatabase(databasePath);
    try {
      const service = new GenerationJobService(database, config, mockExtractor(source), mockOllama({ topics: [{ name: "IP Addressing" }], questions: [] }));
      const result = await service.enqueue({ originalName: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("pdf") });
      const job = await waitForTerminal(service, result.jobId);
      assert.equal(job.state, "failed");
      assert.equal(job.errorCode, "INVALID_MODEL_OUTPUT");
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM question_sets").get().count, 0);
    } finally {
      database.close();
    }
  });
});
