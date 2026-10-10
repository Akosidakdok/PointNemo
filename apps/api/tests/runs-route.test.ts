import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { RunDetail } from "@point-nemo/shared";
import { createApp } from "../src/app.js";
import { initializeDatabase, type SqliteDatabase } from "../src/db.js";
import type { ApiConfig } from "../src/config.js";
import { generationMetadata } from "../src/services/generation-metadata.js";
import { OllamaService } from "../src/services/ollama.js";
import { TOKENIZER_DIGEST } from "../src/services/token-budget.js";
import { GameRunService } from "../src/services/game-run.js";

const testConfig: ApiConfig = {
  port: 0,
  databasePath: "",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "qwen2.5:1.5b",
  ollamaNumCtx: 8192,
  ollamaMaxInputTokens: 4096,
  ollamaMaxOutputTokens: 3072,
  inferenceTimeoutMs: 1_000,
  jobTimeoutMs: 2_000,
};

class FixtureOllama extends OllamaService {
  async getStatus() {
    return { available: true, model: testConfig.ollamaModel, message: "Fixture readiness", digest: "fixture-digest",
      tokenizerReady: true, tokenizerDigest: TOKENIZER_DIGEST };
  }
}

function seedQuestionSet(database: SqliteDatabase): string {
  const documentId = randomUUID();
  const questionSetId = randomUUID();
  const topicIds = [randomUUID(), randomUUID(), randomUUID()];
  const topicNames = ["IP Addressing", "DNS", "HTTP"];

  database.prepare(`
    INSERT INTO documents (id, filename, sha256, page_count, normalized_char_count, pages_json)
    VALUES (?, 'test.pdf', 'hash-route-test', 1, 100, '[]')
  `).run(documentId);

  const metadata = generationMetadata(testConfig, "fixture-digest", TOKENIZER_DIGEST, "hash-route-test");
  database.prepare(`
    INSERT INTO question_sets (id, document_id, model_tag, model_digest, settings_hash,
      extractor_version, prompt_version, schema_version, tokenizer_digest, document_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(questionSetId, documentId, metadata.modelTag, metadata.modelDigest, metadata.settingsHash,
    metadata.extractorVersion, metadata.promptVersion, metadata.schemaVersion, metadata.tokenizerDigest, metadata.documentHash);

  const insertTopic = database.prepare(`
    INSERT INTO topics_p0 (id, question_set_id, name) VALUES (?, ?, ?)
  `);
  topicIds.forEach((id, index) => {
    insertTopic.run(id, questionSetId, topicNames[index]);
  });

  const insertQuestion = database.prepare(`
    INSERT INTO questions_p0
      (id, question_set_id, topic_id, difficulty, prompt, options_json, answer_index, explanation, evidence_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const difficulties: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
  for (const difficulty of difficulties) {
    for (let topicIdx = 0; topicIdx < 3; topicIdx++) {
      insertQuestion.run(
        randomUUID(),
        questionSetId,
        topicIds[topicIdx],
        difficulty,
        `${topicNames[topicIdx]} ${difficulty} prompt`,
        JSON.stringify(["Option A", "Option B", "Option C", "Option D"]),
        0,
        "Explanation text",
        JSON.stringify([{ pageNumber: 1, chunkId: "c1", quote: "Sample evidence quote" }]),
      );
    }
  }

  return questionSetId;
}

async function withRoutes(callback: (context: { db: SqliteDatabase; questionSetId: string; baseUrl: string }) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "point-nemo-routes-"));
  const dbPath = join(directory, "test.sqlite");
  const db = initializeDatabase(dbPath);
  const questionSetId = seedQuestionSet(db);

  const app = createApp(testConfig, db, new FixtureOllama(testConfig));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try { await callback({ db, questionSetId, baseUrl }); }
  finally {
    await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test("runs HTTP API endpoints: create, get, answer, and error contracts", async () => {
  await withRoutes(async ({ questionSetId, baseUrl }) => {
    // 1. POST /api/runs with invalid payload -> 400
    const invalidCreateRes = await fetch(`${baseUrl}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionSetId: "not-a-uuid" }),
    });
    assert.equal(invalidCreateRes.status, 400);

    // 2. POST /api/runs with valid questionSetId -> 201
    const createRes = await fetch(`${baseUrl}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionSetId }),
    });
    assert.equal(createRes.status, 201);
    const createData = (await createRes.json()) as { success: boolean; data: { id: string; currentSlot: { id: string } } };
    assert.equal(createData.success, true);
    assert.ok(createData.data.id);
    const runId = createData.data.id;
    const slot0Id = createData.data.currentSlot.id;

    // 3. GET /api/runs/:id -> 200
    const getRes = await fetch(`${baseUrl}/api/runs/${runId}`);
    assert.equal(getRes.status, 200);
    const getData = (await getRes.json()) as { success: boolean; data: RunDetail };
    assert.equal(getData.success, true);
    assert.equal(getData.data.id, runId);
    assert.equal(getData.data.state, "active");
    assert.equal(getData.data.status, "active");
    assert.equal(getData.data.filename, "test.pdf");
    assert.equal(getData.data.documentName, "test.pdf");
    assert.ok(getData.data.documentId);
    assert.ok(getData.data.updatedAt);
    assert.equal(getData.data.slots?.length, 18);
    assert.equal(getData.data.bossOrder?.length, 9);
    assert.equal("answerIndex" in getData.data.currentSlot!.question, false);

    // 4. POST /api/runs/:id/answers with invalid index -> 400
    const invalidAnswerRes = await fetch(`${baseUrl}/api/runs/${runId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId: slot0Id, selectedOptionIndex: 9 }),
    });
    assert.equal(invalidAnswerRes.status, 400);

    // 5. POST /api/runs/:id/answers with valid answer -> 200
    const answerRes = await fetch(`${baseUrl}/api/runs/${runId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId: slot0Id, selectedOptionIndex: 0 }),
    });
    assert.equal(answerRes.status, 200);
    const answerData = (await answerRes.json()) as {
      success: boolean;
      data: { feedback: { isCorrect: boolean }; run: RunDetail };
    };
    assert.equal(answerData.success, true);
    assert.equal(answerData.data.feedback.isCorrect, true);
    assert.equal(answerData.data.run.currentSlotIndex, 1);
    assert.equal(answerData.data.run.attempts?.[0]?.questionId, getData.data.currentSlot?.question.id);
    assert.equal(answerData.data.run.attempts?.[0]?.options?.length, 4);
    assert.equal(answerData.data.run.attempts?.[0]?.prompt, getData.data.currentSlot?.question.prompt);
    assert.equal(answerData.data.run.attempts?.[0]?.topic, getData.data.currentSlot?.question.topicName);

    const alias = (body: unknown) => fetch(`${baseUrl}/api/runs/${runId}/answer`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    assert.equal((await alias({ selectedAnswer: 0 })).status, 400, "The compatibility alias requires an explicit slot ID.");
    const identical = await alias({ slotId: slot0Id, selectedAnswer: 0 });
    assert.equal(identical.status, 200);
    assert.deepEqual((await identical.json() as {data:{run:RunDetail}}).data.run, answerData.data.run);
    assert.equal((await alias({ slotId: slot0Id, selectedAnswer: 1 })).status, 409);
    assert.equal((await alias({ slotId: getData.data.slots![2]!.id, selectedAnswer: 0 })).status, 409);
  });
});

test("run routes reject incompatible saved metadata and rules on create/resume/answers", async () => {
  await withRoutes(async ({ db, questionSetId, baseUrl }) => {
    const game = new GameRunService(db);
    const run = game.createRun(questionSetId);
    const post = (path: string, body: unknown) => fetch(baseUrl + path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const metadata = generationMetadata(testConfig, "fixture-digest", TOKENIZER_DIGEST, "hash-route-test");
    db.prepare("UPDATE question_sets SET schema_version='unsupported-schema' WHERE id=?").run(questionSetId);
    assert.equal((await post("/api/runs", { questionSetId })).status, 409);
    assert.equal((await fetch(`${baseUrl}/api/runs/${run.id}`)).status, 409);
    assert.equal((await post(`/api/runs/${run.id}/answers`, { slotId: run.currentSlot!.id, selectedOptionIndex: 0 })).status, 409);
    assert.deepEqual(game.getRun(run.id), run);
    db.prepare("UPDATE question_sets SET schema_version=? WHERE id=?").run(metadata.schemaVersion, questionSetId);
    db.prepare("UPDATE runs SET rules_version='previous-rules' WHERE id=?").run(run.id);
    const resume = await fetch(`${baseUrl}/api/runs/${run.id}`);
    assert.equal(resume.status, 409);
    assert.equal((await resume.json() as {error:{code:string}}).error.code, "RUN_INCOMPATIBLE");
    assert.equal((await post(`/api/runs/${run.id}/answers`, { slotId: run.currentSlot!.id, selectedOptionIndex: 0 })).status, 409);
    assert.equal(game.getRun(run.id).attempts?.length, 0);
  });
});

test("completed history and identical final retries remain available after runtime metadata changes", async () => {
  await withRoutes(async ({ db, questionSetId, baseUrl }) => {
    const game = new GameRunService(db);
    let run = game.createRun(questionSetId);
    let finalSlotId = "";
    for (let i = 0; i < 18; i++) {
      finalSlotId = run.currentSlot!.id;
      run = game.submitAnswer(run.id, finalSlotId, 0).run;
    }
    assert.equal(run.state, "completed");
    db.prepare("UPDATE question_sets SET prompt_version='legacy-incompatible' WHERE id=?").run(questionSetId);
    const history = await fetch(`${baseUrl}/api/runs/${run.id}`);
    assert.equal(history.status, 200);
    assert.deepEqual((await history.json() as {data:RunDetail}).data, JSON.parse(JSON.stringify(run)));
    const retry = await fetch(`${baseUrl}/api/runs/${run.id}/answers`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId: finalSlotId, selectedOptionIndex: 0 }),
    });
    assert.equal(retry.status, 200);
    assert.deepEqual((await retry.json() as {data:{run:RunDetail}}).data.run, JSON.parse(JSON.stringify(run)));
    assert.equal(run.xp, 180);
  });
});
