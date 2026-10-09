import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { initializeDatabase, type SqliteDatabase } from "../src/db.js";
import type { ApiConfig } from "../src/config.js";

const testConfig: ApiConfig = {
  port: 0,
  databasePath: "",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "test-model",
  ollamaNumCtx: 8192,
  ollamaMaxInputTokens: 4096,
  ollamaMaxOutputTokens: 3072,
  inferenceTimeoutMs: 1_000,
  jobTimeoutMs: 2_000,
};

function seedQuestionSet(database: SqliteDatabase): string {
  const documentId = randomUUID();
  const questionSetId = randomUUID();
  const topicIds = [randomUUID(), randomUUID(), randomUUID()];
  const topicNames = ["IP Addressing", "DNS", "HTTP"];

  database.prepare(`
    INSERT INTO documents (id, filename, sha256, page_count, normalized_char_count, pages_json)
    VALUES (?, 'test.pdf', 'hash-route-test', 1, 100, '[]')
  `).run(documentId);

  database.prepare(`
    INSERT INTO question_sets (id, document_id, model_tag, model_digest, settings_hash)
    VALUES (?, ?, 'qwen2.5:1.5b', 'digest-route', 'settings-route')
  `).run(questionSetId, documentId);

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

test("runs HTTP API endpoints: create, get, answer, and error contracts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "point-nemo-routes-"));
  const dbPath = join(directory, "test.sqlite");
  const db = initializeDatabase(dbPath);
  const questionSetId = seedQuestionSet(db);

  const app = createApp(testConfig, db);
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
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
    const getData = (await getRes.json()) as { success: boolean; data: { id: string; state: string } };
    assert.equal(getData.success, true);
    assert.equal(getData.data.id, runId);
    assert.equal(getData.data.state, "active");

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
      data: { feedback: { isCorrect: boolean }; run: { currentSlotIndex: number } };
    };
    assert.equal(answerData.success, true);
    assert.equal(answerData.data.feedback.isCorrect, true);
    assert.equal(answerData.data.run.currentSlotIndex, 1);
  } finally {
    server.close();
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
