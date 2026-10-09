import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initializeDatabase, type SqliteDatabase } from "../src/db.js";
import { ConflictError, BadRequestError } from "../src/errors.js";
import { GameRunService } from "../src/services/game-run.js";

async function withDatabase<T>(callback: (databasePath: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "point-nemo-gamerun-"));
  try {
    return await callback(join(directory, "test.sqlite"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

interface SeedData {
  documentId: string;
  questionSetId: string;
  topicIds: string[];
  questions: Array<{
    id: string;
    topicId: string;
    difficulty: "easy" | "medium" | "hard";
    prompt: string;
    answerIndex: number;
  }>;
}

function seedQuestionSet(database: SqliteDatabase): SeedData {
  const documentId = randomUUID();
  const questionSetId = randomUUID();
  const topicIds = [randomUUID(), randomUUID(), randomUUID()];
  const topicNames = ["IP Addressing", "DNS", "HTTP"];

  database.prepare(`
    INSERT INTO documents (id, filename, sha256, page_count, normalized_char_count, pages_json)
    VALUES (?, 'test.pdf', 'hash-test', 1, 100, '[]')
  `).run(documentId);

  database.prepare(`
    INSERT INTO question_sets (id, document_id, model_tag, model_digest, settings_hash)
    VALUES (?, ?, 'qwen2.5:1.5b', 'digest-1', 'settings-1')
  `).run(questionSetId, documentId);

  const insertTopic = database.prepare(`
    INSERT INTO topics_p0 (id, question_set_id, name) VALUES (?, ?, ?)
  `);
  topicIds.forEach((id, index) => {
    insertTopic.run(id, questionSetId, topicNames[index]);
  });

  const questions: SeedData["questions"] = [];
  const insertQuestion = database.prepare(`
    INSERT INTO questions_p0
      (id, question_set_id, topic_id, difficulty, prompt, options_json, answer_index, explanation, evidence_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const difficulties: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
  for (const difficulty of difficulties) {
    for (let topicIdx = 0; topicIdx < 3; topicIdx++) {
      const qId = randomUUID();
      const prompt = `${topicNames[topicIdx]} ${difficulty} question?`;
      const options = ["Option A (Correct)", "Option B", "Option C", "Option D"];
      const answerIndex = 0;
      const explanation = `Explanation for ${prompt}`;
      const evidence = [{ pageNumber: 1, chunkId: "chunk-1", quote: "IPv4 uses 32 bits..." }];

      insertQuestion.run(
        qId,
        questionSetId,
        topicIds[topicIdx],
        difficulty,
        prompt,
        JSON.stringify(options),
        answerIndex,
        explanation,
        JSON.stringify(evidence),
      );

      questions.push({
        id: qId,
        topicId: topicIds[topicIdx]!,
        difficulty,
        prompt,
        answerIndex,
      });
    }
  }

  return { documentId, questionSetId, topicIds, questions };
}

test("run creation from a ready question set", async () => {
  await withDatabase(async (databasePath) => {
    const db = initializeDatabase(databasePath);
    try {
      const seed = seedQuestionSet(db);
      const service = new GameRunService(db);
      const run = service.createRun(seed.questionSetId);

      assert.ok(run.id);
      assert.equal(run.questionSetId, seed.questionSetId);
      assert.equal(run.state, "active");
      assert.equal(run.playerHp, 100);
      assert.equal(run.currentEncounterHp, 100);
      assert.equal(run.xp, 0);
      assert.equal(run.combo, 0);
      assert.equal(run.currentSlotIndex, 0);
      assert.equal(run.rulesVersion, "1.0");

      assert.ok(run.currentSlot);
      assert.equal(run.currentSlot.slotIndex, 0);
      assert.equal(run.currentSlot.encounterType, "surface");
      assert.equal(run.currentSlot.question.difficulty, "easy");
      assert.equal(run.currentSlot.question.options.length, 4);

      // Verify active question does not leak answer, explanation, or evidence
      assert.equal("answerIndex" in run.currentSlot.question, false);
      assert.equal("explanation" in run.currentSlot.question, false);
      assert.equal("evidence" in run.currentSlot.question, false);
    } finally {
      db.close();
    }
  });
});

test("fixed 18-slot ordering", async () => {
  await withDatabase(async (databasePath) => {
    const db = initializeDatabase(databasePath);
    try {
      const seed = seedQuestionSet(db);
      const service = new GameRunService(db);
      const run = service.createRun(seed.questionSetId);

      const slots = db.prepare(`
        SELECT rs.slot_index, rs.encounter_type, q.difficulty, q.id as question_id
        FROM run_slots rs
        JOIN questions_p0 q ON rs.question_id = q.id
        WHERE rs.run_id = ?
        ORDER BY rs.slot_index ASC
      `).all(run.id) as Array<{
        slot_index: number;
        encounter_type: string;
        difficulty: string;
        question_id: string;
      }>;

      assert.equal(slots.length, 18);

      // Slots 0..2: surface, all easy
      for (let i = 0; i < 3; i++) {
        assert.equal(slots[i]!.slot_index, i);
        assert.equal(slots[i]!.encounter_type, "surface");
        assert.equal(slots[i]!.difficulty, "easy");
      }

      // Slots 3..5: twilight, all medium
      for (let i = 3; i < 6; i++) {
        assert.equal(slots[i]!.slot_index, i);
        assert.equal(slots[i]!.encounter_type, "twilight");
        assert.equal(slots[i]!.difficulty, "medium");
      }

      // Slots 6..8: midnight, all hard
      for (let i = 6; i < 9; i++) {
        assert.equal(slots[i]!.slot_index, i);
        assert.equal(slots[i]!.encounter_type, "midnight");
        assert.equal(slots[i]!.difficulty, "hard");
      }

      // Slots 9..17: boss, all 9 unique questions reused
      const bossQuestionIds = new Set<string>();
      for (let i = 9; i < 18; i++) {
        assert.equal(slots[i]!.slot_index, i);
        assert.equal(slots[i]!.encounter_type, "boss");
        bossQuestionIds.add(slots[i]!.question_id);
      }
      assert.equal(bossQuestionIds.size, 9);
    } finally {
      db.close();
    }
  });
});

test("correct and incorrect answers calculate HP, combo, XP, and damage", async () => {
  await withDatabase(async (databasePath) => {
    const db = initializeDatabase(databasePath);
    try {
      const seed = seedQuestionSet(db);
      const service = new GameRunService(db);
      const run = service.createRun(seed.questionSetId);

      // Answer slot 0 correctly (option 0)
      const slot0Id = run.currentSlot!.id;
      const turn1 = service.submitAnswer(run.id, slot0Id, 0);

      assert.equal(turn1.feedback.isCorrect, true);
      assert.equal(turn1.feedback.playerDamageTaken, 0);
      assert.equal(turn1.feedback.enemyDamageTaken, 50);
      assert.equal(turn1.feedback.xpAwarded, 10);
      assert.equal(turn1.run.playerHp, 100);
      assert.equal(turn1.run.currentEncounterHp, 50);
      assert.equal(turn1.run.combo, 1);
      assert.equal(turn1.run.xp, 10);
      assert.equal(turn1.run.currentSlotIndex, 1);

      // Answer slot 1 incorrectly (option 1)
      const slot1Id = turn1.run.currentSlot!.id;
      const turn2 = service.submitAnswer(run.id, slot1Id, 1);

      assert.equal(turn2.feedback.isCorrect, false);
      assert.equal(turn2.feedback.playerDamageTaken, 50);
      assert.equal(turn2.feedback.enemyDamageTaken, 0);
      assert.equal(turn2.feedback.xpAwarded, 0);
      assert.equal(turn2.run.playerHp, 50);
      assert.equal(turn2.run.currentEncounterHp, 50);
      assert.equal(turn2.run.combo, 0); // combo reset!
      assert.equal(turn2.run.xp, 10); // xp untouched
      assert.equal(turn2.run.currentSlotIndex, 2);
    } finally {
      db.close();
    }
  });
});

test("duplicate identical retry idempotence", async () => {
  await withDatabase(async (databasePath) => {
    const db = initializeDatabase(databasePath);
    try {
      const seed = seedQuestionSet(db);
      const service = new GameRunService(db);
      const run = service.createRun(seed.questionSetId);

      const slot0Id = run.currentSlot!.id;
      const turn1 = service.submitAnswer(run.id, slot0Id, 0);

      // Resubmit the exact same answer on slot 0
      const retry = service.submitAnswer(run.id, slot0Id, 0);

      assert.equal(retry.feedback.isCorrect, true);
      assert.equal(retry.feedback.xpAwarded, 10);
      assert.equal(retry.run.currentSlotIndex, turn1.run.currentSlotIndex);
      assert.equal(retry.run.xp, 10); // NOT 20
      assert.equal(retry.run.currentEncounterHp, 50); // NOT 0

      const attemptsCount = db.prepare("SELECT COUNT(*) as count FROM run_attempts WHERE run_id = ?").get(run.id) as { count: number };
      assert.equal(attemptsCount.count, 1);
    } finally {
      db.close();
    }
  });
});

test("changed answer conflict", async () => {
  await withDatabase(async (databasePath) => {
    const db = initializeDatabase(databasePath);
    try {
      const seed = seedQuestionSet(db);
      const service = new GameRunService(db);
      const run = service.createRun(seed.questionSetId);

      const slot0Id = run.currentSlot!.id;
      service.submitAnswer(run.id, slot0Id, 0);

      assert.throws(() => {
        service.submitAnswer(run.id, slot0Id, 2);
      }, (error: unknown) => {
        assert.ok(error instanceof ConflictError);
        assert.equal(error.code, "ANSWER_CONFLICT");
        return true;
      });
    } finally {
      db.close();
    }
  });
});

test("out-of-order answer conflict", async () => {
  await withDatabase(async (databasePath) => {
    const db = initializeDatabase(databasePath);
    try {
      const seed = seedQuestionSet(db);
      const service = new GameRunService(db);
      const run = service.createRun(seed.questionSetId);

      // Fetch slot 1
      const slot1 = db.prepare("SELECT id FROM run_slots WHERE run_id = ? AND slot_index = 1").get(run.id) as { id: string };

      assert.throws(() => {
        service.submitAnswer(run.id, slot1.id, 0);
      }, (error: unknown) => {
        assert.ok(error instanceof ConflictError);
        assert.equal(error.code, "OUT_OF_ORDER");
        return true;
      });
    } finally {
      db.close();
    }
  });
});

test("boss 8/9 pass and run completion", async () => {
  await withDatabase(async (databasePath) => {
    const db = initializeDatabase(databasePath);
    try {
      const seed = seedQuestionSet(db);
      const service = new GameRunService(db);
      let currentRun = service.createRun(seed.questionSetId);

      // Surface: answer 2 correct, 1 wrong (2/3 -> passes)
      for (let i = 0; i < 3; i++) {
        const slot = currentRun.currentSlot!;
        const answer = i === 1 ? 1 : 0; // 0 correct, 1 wrong, 2 correct
        const res = service.submitAnswer(currentRun.id, slot.id, answer);
        currentRun = res.run;
      }
      assert.equal(currentRun.state, "active");
      assert.equal(currentRun.currentSlotIndex, 3);
      assert.equal(currentRun.playerHp, 100); // reset
      assert.equal(currentRun.currentEncounterHp, 100); // reset

      // Twilight: answer 2 correct, 1 wrong (2/3 -> passes)
      for (let i = 3; i < 6; i++) {
        const slot = currentRun.currentSlot!;
        const answer = i === 4 ? 1 : 0;
        const res = service.submitAnswer(currentRun.id, slot.id, answer);
        currentRun = res.run;
      }
      assert.equal(currentRun.state, "active");
      assert.equal(currentRun.currentSlotIndex, 6);
      assert.equal(currentRun.playerHp, 100); // reset

      // Midnight: answer 2 correct, 1 wrong (2/3 -> passes)
      for (let i = 6; i < 9; i++) {
        const slot = currentRun.currentSlot!;
        const answer = i === 7 ? 1 : 0;
        const res = service.submitAnswer(currentRun.id, slot.id, answer);
        currentRun = res.run;
      }
      assert.equal(currentRun.state, "active");
      assert.equal(currentRun.currentSlotIndex, 9);
      assert.equal(currentRun.playerHp, 100); // reset
      assert.equal(currentRun.currentEncounterHp, 80); // boss starts at 80 HP!

      // Boss (slots 9..17): answer 8 correct, 1 wrong (8/9 -> passes!)
      let lastSlotId = "";
      for (let i = 9; i < 18; i++) {
        const slot = currentRun.currentSlot!;
        lastSlotId = slot.id;
        const answer = i === 12 ? 1 : 0; // only 1 mistake
        const res = service.submitAnswer(currentRun.id, slot.id, answer);
        currentRun = res.run;
      }

      assert.equal(currentRun.state, "completed");
      assert.equal(currentRun.currentSlotIndex, 18);
      assert.equal(currentRun.currentSlot, undefined);

      // Retrying final slot identical answer returns original feedback and completed run
      const retry = service.submitAnswer(currentRun.id, lastSlotId, 0);
      assert.equal(retry.run.state, "completed");
      assert.equal(retry.feedback.isCorrect, true);
    } finally {
      db.close();
    }
  });
});

test("boss 7/9 fail ends run in failed state", async () => {
  await withDatabase(async (databasePath) => {
    const db = initializeDatabase(databasePath);
    try {
      const seed = seedQuestionSet(db);
      const service = new GameRunService(db);
      let currentRun = service.createRun(seed.questionSetId);

      // Advance through zones with perfect scores (3/3 each)
      for (let i = 0; i < 9; i++) {
        const slot = currentRun.currentSlot!;
        const res = service.submitAnswer(currentRun.id, slot.id, 0);
        currentRun = res.run;
      }

      // Boss: answer 7 correct, 2 wrong (7/9 -> fails!)
      for (let i = 9; i < 18; i++) {
        const slot = currentRun.currentSlot!;
        const answer = i === 10 || i === 11 ? 1 : 0; // 2 mistakes
        const res = service.submitAnswer(currentRun.id, slot.id, answer);
        currentRun = res.run;
      }

      assert.equal(currentRun.state, "failed");
      assert.equal(currentRun.currentSlotIndex, 18);
    } finally {
      db.close();
    }
  });
});

test("transaction rollback on invalid answers", async () => {
  await withDatabase(async (databasePath) => {
    const db = initializeDatabase(databasePath);
    try {
      const seed = seedQuestionSet(db);
      const service = new GameRunService(db);
      const run = service.createRun(seed.questionSetId);

      // Submit an invalid option index (e.g. 5)
      assert.throws(() => {
        service.submitAnswer(run.id, run.currentSlot!.id, 5);
      }, (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.equal(error.code, "INVALID_OPTION_INDEX");
        return true;
      });

      // Verify no attempt was recorded and state was untouched
      const attemptsCount = db.prepare("SELECT COUNT(*) as count FROM run_attempts WHERE run_id = ?").get(run.id) as { count: number };
      assert.equal(attemptsCount.count, 0);

      const runRow = db.prepare("SELECT current_slot_index FROM runs WHERE id = ?").get(run.id) as { current_slot_index: number };
      assert.equal(runRow.current_slot_index, 0);
    } finally {
      db.close();
    }
  });
});

test("restart/read persistence from SQLite", async () => {
  await withDatabase(async (databasePath) => {
    let runId: string;
    let slot1Id: string;

    // First session: start run and answer 1 question
    {
      const db1 = initializeDatabase(databasePath);
      try {
        const seed = seedQuestionSet(db1);
        const service1 = new GameRunService(db1);
        const run1 = service1.createRun(seed.questionSetId);
        runId = run1.id;
        const res = service1.submitAnswer(runId, run1.currentSlot!.id, 0);
        slot1Id = res.run.currentSlot!.id;
        assert.equal(res.run.xp, 10);
        assert.equal(res.run.currentSlotIndex, 1);
      } finally {
        db1.close();
      }
    }

    // Second session: re-open database from disk and verify persistence
    {
      const db2 = initializeDatabase(databasePath);
      try {
        const service2 = new GameRunService(db2);
        const restoredRun = service2.getRun(runId);

        assert.equal(restoredRun.id, runId);
        assert.equal(restoredRun.state, "active");
        assert.equal(restoredRun.xp, 10);
        assert.equal(restoredRun.combo, 1);
        assert.equal(restoredRun.currentSlotIndex, 1);
        assert.equal(restoredRun.currentSlot?.id, slot1Id);
        assert.equal(restoredRun.attempts?.length, 1);
        assert.equal(restoredRun.attempts?.[0]?.isCorrect, true);

        // Continue playing in new session
        const nextTurn = service2.submitAnswer(runId, slot1Id, 0);
        assert.equal(nextTurn.run.xp, 20);
        assert.equal(nextTurn.run.currentSlotIndex, 2);
      } finally {
        db2.close();
      }
    }
  });
});
