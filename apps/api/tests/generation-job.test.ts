import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { AIQuestionSetOutput } from "@point-nemo/shared";
import { initializeDatabase } from "../src/db.js";
import { GenerationJobService } from "../src/services/generation-job.js";
import { inspectQuestions, parseQuestionPlan } from "../src/services/question-quality.js";
import { LocalPdfExtractor, type DocumentExtractor, type ExtractedDocument, type UploadedDocument } from "../src/services/document-extractor.js";
import type { ApiConfig } from "../src/config.js";
import type { OllamaService } from "../src/services/ollama.js";
import { TOKENIZER_DIGEST } from "../src/services/token-budget.js";

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

const sourceQuote = "IPv4 addresses use 32 bits. IPv6 addresses use 128 bits. IPv4 addresses use dotted decimal notation. Domain Name System (DNS) translates domain names into IP addresses. A resolver queries DNS servers for records. DNS records map names to addresses. Hypertext Transfer Protocol (HTTP) uses methods to describe requests. GET requests retrieve a resource. POST requests send data to a server.";
const source: ExtractedDocument = {
  sha256: "fixture-hash",
  pageCount: 1,
  normalizedCharCount: sourceQuote.length,
  pagesJson: JSON.stringify([{ pageNumber: 1, chunkId: "chunk-1", text: sourceQuote }]),
};

function validOutput(): AIQuestionSetOutput {
  const topics = ["IP Addressing", "DNS", "HTTP"];
  const drafts = [
    { prompt: "How many bits do IPv4 addresses use?", answer: "32 bits", choices: ["128 bits", "16 bits", "64 bits"] },
    { prompt: "How are IPv4 addresses written?", answer: "dotted decimal notation", choices: ["binary notation", "hexadecimal notation", "slash notation"] },
    { prompt: "How many bits does IPv6 provide for an address?", answer: "128 bits", choices: ["32 bits", "16 bits", "64 bits"] },
    { prompt: "What does DNS translate domain names into?", answer: "IP addresses", choices: ["DNS records", "DNS servers", "GET requests"] },
    { prompt: "Which servers does a resolver query?", answer: "DNS servers", choices: ["domain names", "IP addresses", "DNS records"] },
    { prompt: "What do DNS records do?", answer: "map names to addresses", choices: ["use dotted decimal notation", "retrieve a resource", "send data to a server"] },
    { prompt: "What does HTTP use to describe requests?", answer: "methods", choices: ["packets", "IP addresses", "DNS records"] },
    { prompt: "What does a GET request do?", answer: "retrieve a resource", choices: ["send data to a server", "translate domain names", "map names to addresses"] },
    { prompt: "Which method sends data to a server?", answer: "POST", choices: ["GET", "IPv4", "DNS"] },
  ];
  const questions = drafts.map((draft,index) => ({
    topicName: topics[Math.floor(index/3)]!,
    difficulty: (["easy", "medium", "hard"] as const)[index%3]!,
    prompt: draft.prompt,
    options: [draft.answer,...draft.choices],
    answerIndex: 0,
    explanation: "The source text supports the selected answer.",
    evidence: [{ pageNumber: 1, chunkId: "chunk-1", quote: sourceQuote }],
  }));
  return { topics: topics.map((name) => ({ name })), questions };
}

test("calibration catches reworded duplicate facts and overlapping answer choices", () => {
  const duplicate = validOutput();
  duplicate.questions[1]!.prompt = "How many bits are in an IPv4 address?";
  duplicate.questions[1]!.options = ["32 bits", "128 bits", "16 bits", "64 bits"];
  duplicate.questions[1]!.answerIndex = 0;
  const duplicateReport = inspectQuestions(duplicate, source.pagesJson);
  assert.ok(duplicateReport.issues.some((issue) => issue.index === 1 && issue.code === "DUPLICATE_QUESTION"));

  const overlap = validOutput();
  overlap.questions[0]!.options = ["32 bits", "uses 32 bits", "16 bits", "64 bits"];
  const overlapReport = inspectQuestions(overlap, source.pagesJson);
  assert.ok(overlapReport.issues.some((issue) => issue.index === 0 && issue.message.includes("[answer_choices]")));

  const synonyms = validOutput();
  synonyms.questions[0]!.options = ["32 bits", "where to send a packet", "where to deliver a packet", "64 bits"];
  const synonymReport = inspectQuestions(synonyms, source.pagesJson);
  assert.ok(synonymReport.issues.some((issue) => issue.index === 0 && issue.message.includes("[answer_choices]")));

  const unsupportedAnswer = validOutput();
  unsupportedAnswer.questions[0]!.options[0] = "IPv4 address capacity";
  const unsupportedAnswerReport = inspectQuestions(unsupportedAnswer, source.pagesJson);
  assert.ok(unsupportedAnswerReport.issues.some((issue) => issue.index === 0 && issue.code === "SOURCE_EVIDENCE_INVALID" && issue.message.includes("short exact phrase")));
});

test("planner rejects reusing the same focus fact in multiple slots", () => {
  const ids = Array.from({ length: 9 }, (_,index)=>`p1s${index+1}`);
  const topics = ["IP Addressing", "DNS", "HTTP"].map((name,topicIndex)=>({
    name,
    objectives:Array.from({length:3},(_,objectiveIndex)=>{
      const index=topicIndex*3+objectiveIndex;
      return {evidenceId:ids[index]!,goal:`Objective ${index+1}`};
    }),
  }));
  const focuses = new Map(ids.map((id,index)=>[id,index<2 ? "One repeated factual statement." : `Unique fact ${index+1}.`]));
  assert.throws(()=>parseQuestionPlan({topics},new Set(ids),focuses),{code:"INVALID_MODEL_OUTPUT"});
});

test("planner allows repeated generic goal wording when each slot has a different source fact", () => {
  const ids = Array.from({ length: 9 }, (_,index)=>`p1s${index+1}`);
  const topics = ["IP Addressing", "DNS", "HTTP"].map((name,topicIndex)=>({
    name,
    objectives: ids.slice(topicIndex*3,topicIndex*3+3).map((evidenceId)=>({evidenceId,goal:"Explain the source fact."})),
  }));
  const focuses = new Map(ids.map((id,index)=>[id,`Unique source fact ${index+1}.`]));
  const plan = parseQuestionPlan({topics},new Set(ids),focuses);
  assert.equal(plan.slots.length,9);
});

test("answer-choice repair receives other PDF facts while preserving the cited answer", async () => {
  await withDatabase(async (databasePath) => {
    const database = initializeDatabase(databasePath);
    let repairSource = "";
    const base = validOutput();
    const factIds = [1,3,2,4,5,6,7,8,9];
    const objectives = base.questions.map((_,index)=>({evidenceId:`p1s${factIds[index]}`,goal:`Test source fact ${index+1}.`}));
    const planTopics = base.topics.map((topic,topicIndex)=>({name:topic.name,objectives:objectives.slice(topicIndex*3,topicIndex*3+3)}));
    const ollama = {
      getStatus: async () => ({ available:true,model:config.ollamaModel,message:"ready",digest:"test-model-digest",tokenizerReady:true,tokenizerDigest:TOKENIZER_DIGEST }),
      planQuestions: async () => ({topics:planTopics}),
      generateQuestions: async (_source:string,options:any={}) => {
        if (options.repair) {
          repairSource = _source;
          const index=options.repair.slots[0]!.index;
          const question=options.repair.questions[index];
          const distractors=index===0 ? ["128 bits","16 bits","64 bits"] : question.options.filter((_option:string,optionIndex:number)=>optionIndex!==question.answerIndex);
          return {questions:{[index]:{distractors}}};
        }
        const index=options.slots[0]!;
        const question=base.questions[index]!;
        const distractors=question.options.filter((_option,optionIndex)=>optionIndex!==question.answerIndex);
        if (index===0) distractors[0]="uses 32 bits";
        return {questions:{[index]:{evidenceId:`p1s${factIds[index]}`,prompt:question.prompt,
          correctAnswer:question.options[question.answerIndex],distractors,explanation:question.explanation}}};
      },
    } as unknown as OllamaService;
    try {
      const service = new GenerationJobService(database,config,mockExtractor(source),ollama);
      const result = await service.enqueue({originalName:"notes.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\n%%EOF")});
      const job = await waitForTerminal(service,result.jobId);
      assert.equal(job.state,"ready",job.errorMessage);
      assert.ok(repairSource.includes("[p1s2 | page 1]"),"repair includes another passage from the same PDF");
      const saved = service.getQuestionSet(job.questionSetId!);
      assert.equal(saved.questions[0]!.options[saved.questions[0]!.answerIndex],"32 bits");
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM question_sets").get().count,1);
    } finally {
      database.close();
    }
  });
});

function mockExtractor(result: ExtractedDocument): DocumentExtractor {
  return { extractText: async (_file: UploadedDocument) => result };
}

function mockOllama(output: unknown): OllamaService {
  return {
    generateQuestions: async (_input: string) => output as AIQuestionSetOutput,
    getStatus: async () => ({ available: true, model: config.ollamaModel, message: "ready", digest: "test-model-digest", tokenizerReady: true, tokenizerDigest: TOKENIZER_DIGEST }),
  } as OllamaService;
}

async function waitForTerminal(service: GenerationJobService, jobId: string): Promise<ReturnType<GenerationJobService["getJob"]>> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
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
  assert.equal(extracted.pageCount, 3);
  assert.ok(extracted.normalizedCharCount >= 300);
  assert.match(extracted.sha256, /^[a-f0-9]{64}$/);
});

test("valid model output is persisted as one complete question set", async () => {
  await withDatabase(async (databasePath) => {
    const database = initializeDatabase(databasePath);
    try {
      const service = new GenerationJobService(database, config, mockExtractor(source), mockOllama(validOutput()));
      const result = await service.enqueue({ originalName: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n%%EOF") });
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
      const result = await service.enqueue({ originalName: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n%%EOF") });
      const job = await waitForTerminal(service, result.jobId);
      assert.equal(job.state, "failed");
      assert.equal(job.errorCode, "INVALID_MODEL_OUTPUT");
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM question_sets").get().count, 0);
    } finally {
      database.close();
    }
  });
});
