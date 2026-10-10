import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../apps/api/src/app.js";
import { initializeDatabase } from "../apps/api/src/db.js";
import type { ApiConfig } from "../apps/api/src/config.js";
import type { AIQuestionSetOutput } from "@point-nemo/shared";
import type { OllamaService } from "../apps/api/src/services/ollama.js";
import { TOKENIZER_DIGEST } from "../apps/api/src/services/token-budget.js";

const config: ApiConfig = {
  port: 0,
  databasePath: "",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "qwen2.5:1.5b",
  ollamaNumCtx: 8192,
  ollamaMaxInputTokens: 4096,
  ollamaMaxOutputTokens: 3072,
  inferenceTimeoutMs: 1_000,
  jobTimeoutMs: 5_000,
};

async function runSmokeTest() {
  console.log("=== Point Nemo API Route Smoke Test ===");
  const dir = await mkdtemp(join(tmpdir(), "point-nemo-smoke-"));
  const dbPath = join(dir, "smoke.sqlite");
  const db = initializeDatabase(dbPath);

  // Mock Ollama service returning verified source-grounded answers for the networking fixture
  const fixturePdfPath = fileURLToPath(new URL("../fixtures/networking-demo.pdf", import.meta.url));
  const pdfBuffer = await readFile(fixturePdfPath);

  const mockOllama: OllamaService = {
    generateQuestions: async () => {
      const topics = ["IP Addressing", "DNS Resolution", "HTTP Protocol"];
      const facts = [
        ["How many bits does IPv4 use?", "32 bits", "IPv4 uses 32 bits, typically formatted as four decimal numbers (e.g., 192.168.1.1)."],
        ["How many bits does IPv6 use?", "128 bits", "IPv6 uses 128 bits, represented in hexadecimal."],
        ["What does a router examine when choosing where to forward a packet?", "destination IP address", "A router examines the destination IP address when choosing where to forward a packet."],
        ["What does DNS translate domain names into?", "IP addresses", "DNS translates human-readable domain names into IP addresses."],
        ["Which record contains an IPv6 address?", "AAAA record", "An AAAA record contains an IPv6 address."],
        ["Which lookup result can avoid another DNS lookup?", "unexpired cached answer", "Reusing an unexpired cached answer avoids another lookup."],
        ["What does the server return in HTTP's client-server model?", "response", "In its client-server model, a client sends a request and a server returns a response."],
        ["Which request submits data to a resource for processing?", "POST request", "A POST request submits data to a resource for processing."],
        ["What does status code 404 mean?", "requested resource was not found", "Status code 404 means the requested resource was not found."],
      ];
      const questions = facts.map(([prompt, answer, quote], index) => ({
          topicName: topics[Math.floor(index / 3)]!,
          difficulty: (["easy", "medium", "hard"] as const)[index % 3]!,
          prompt: prompt!,
          options: [answer!, "Gamma rays", "Ocean currents", "Volcanic ash"],
          answerIndex: 0,
          explanation: "The quoted source passage supports the answer.",
          evidence: [{ pageNumber: Math.floor(index / 3) + 1, chunkId: `chunk-${Math.floor(index / 3) + 1}`, quote: quote! }],
        }));
      return {
        topics: topics.map((name) => ({ name })),
        questions,
      } as AIQuestionSetOutput;
    },
    getStatus: async () => ({
      available: true,
      model: config.ollamaModel,
      message: "ready",
      digest: "test-model-digest",
      tokenizerReady: true,
      tokenizerDigest: TOKENIZER_DIGEST,
    }),
  } as OllamaService;

  const app = createApp(config, db, mockOllama);
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Ephemeral API listening on ${baseUrl}`);

  try {
    // 1. GET /api/health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200, "GET /api/health must return 200");
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, "ok");
    console.log("✓ GET /api/health -> 200 ok");

    // 2. POST /api/documents (upload PDF)
    const formData = new FormData();
    formData.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), "networking-demo.pdf");
    const uploadRes = await fetch(`${baseUrl}/api/documents`, {
      method: "POST",
      body: formData,
    });
    assert.equal(uploadRes.status, 202, "POST /api/documents must return 202");
    const uploadJson = (await uploadRes.json()) as { success: boolean; data: { documentId: string; jobId: string } };
    assert.equal(uploadJson.success, true);
    const { jobId } = uploadJson.data;
    console.log(`✓ POST /api/documents -> 202 (jobId: ${jobId})`);

    // 3. Poll GET /api/jobs/:id until ready
    let questionSetId: string | undefined;
    for (let i = 0; i < 60; i++) {
      const jobRes = await fetch(`${baseUrl}/api/jobs/${jobId}`);
      assert.equal(jobRes.status, 200);
      const jobJson = (await jobRes.json()) as { success: boolean; data: { state: string; questionSetId?: string; errorCode?: string } };
      if (jobJson.data.state === "ready" && jobJson.data.questionSetId) {
        questionSetId = jobJson.data.questionSetId;
        break;
      }
      if (jobJson.data.state === "failed") {
        throw new Error(`Job failed with errorCode: ${jobJson.data.errorCode}`);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(questionSetId, "Job must reach ready state and provide questionSetId");
    console.log(`✓ GET /api/jobs/:id -> 200 ready (questionSetId: ${questionSetId})`);

    // 4. GET /api/question-sets/:id
    const qSetRes = await fetch(`${baseUrl}/api/question-sets/${questionSetId}`);
    assert.equal(qSetRes.status, 200);
    const qSetJson = (await qSetRes.json()) as { success: boolean; data: { topics: unknown[]; questions: unknown[] } };
    assert.equal(qSetJson.data.topics.length, 3);
    assert.equal(qSetJson.data.questions.length, 9);
    console.log("✓ GET /api/question-sets/:id -> 200 (3 topics, 9 questions)");

    // 5. POST /api/runs
    const runRes = await fetch(`${baseUrl}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionSetId }),
    });
    assert.equal(runRes.status, 201, "POST /api/runs must return 201");
    const runJson = (await runRes.json()) as {
      success: boolean;
      data: { id: string; state: string; currentSlot: { id: string; slotIndex: number; encounterType: string } };
    };
    assert.equal(runJson.data.state, "active");
    assert.equal(runJson.data.currentSlot.slotIndex, 0);
    assert.equal(runJson.data.currentSlot.encounterType, "surface");
    const runId = runJson.data.id;
    const slot0Id = runJson.data.currentSlot.id;
    console.log(`✓ POST /api/runs -> 201 created (runId: ${runId}, slot 0 ready)`);

    // 6. GET /api/runs/:id
    const getRunRes = await fetch(`${baseUrl}/api/runs/${runId}`);
    assert.equal(getRunRes.status, 200);
    const getRunJson = (await getRunRes.json()) as { success: boolean; data: { id: string; playerHp: number } };
    assert.equal(getRunJson.data.playerHp, 100);
    console.log("✓ GET /api/runs/:id -> 200 (authoritative state retrieved)");

    // 7. POST /api/runs/:id/answers
    const ansRes = await fetch(`${baseUrl}/api/runs/${runId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId: slot0Id, selectedOptionIndex: 0 }),
    });
    assert.equal(ansRes.status, 200);
    const ansJson = (await ansRes.json()) as {
      success: boolean;
      data: {
        feedback: { isCorrect: boolean; explanation: string; evidence: Array<{ quote: string }> };
        run: { currentSlotIndex: number; currentEncounterHp: number; xp: number };
      };
    };
    assert.equal(ansJson.data.feedback.isCorrect, true);
    assert.equal(ansJson.data.run.currentSlotIndex, 1);
    assert.equal(ansJson.data.run.currentEncounterHp, 50);
    assert.equal(ansJson.data.run.xp, 10);
    assert.ok(ansJson.data.feedback.evidence.length > 0);
    console.log("✓ POST /api/runs/:id/answers -> 200 (correct answer recorded, HP and XP updated)");

    // 8. Retry identical answer on slot 0 (idempotent)
    const retryRes = await fetch(`${baseUrl}/api/runs/${runId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId: slot0Id, selectedOptionIndex: 0 }),
    });
    assert.equal(retryRes.status, 200);
    const retryJson = (await retryRes.json()) as { success: boolean; data: { run: { xp: number } } };
    assert.equal(retryJson.data.run.xp, 10, "XP must not be awarded twice on identical retry");
    console.log("✓ Identical retry -> 200 idempotent (no double damage or XP)");

    console.log("=== All Route Smoke Tests Passed! ===");
  } finally {
    server.close();
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

void runSmokeTest();
