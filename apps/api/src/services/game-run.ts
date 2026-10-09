import { randomUUID } from "node:crypto";
import {
  type AnswerFeedback,
  type CurrentSlot,
  type RunAttemptDetail,
  type RunDetail,
  RunDetailSchema,
} from "@point-nemo/shared";
import type { SqliteDatabase } from "../db.js";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.js";

const RULES_VERSION = "1.0";

interface RunRow {
  id: string;
  question_set_id: string;
  state: "active" | "completed" | "failed";
  player_hp: number;
  current_encounter_hp: number;
  xp: number;
  combo: number;
  current_slot_index: number;
  rules_version: string;
  created_at: string;
}

interface SlotRow {
  id: string;
  run_id: string;
  question_id: string;
  slot_index: number;
  encounter_type: "surface" | "twilight" | "midnight" | "boss";
}

interface QuestionRow {
  id: string;
  question_set_id: string;
  topic_id: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options_json: string;
  answer_index: number;
  explanation: string;
  evidence_json: string;
  topic_name: string;
}

interface AttemptRow {
  id: string;
  run_id: string;
  slot_id: string;
  slot_index: number;
  encounter_type: "surface" | "twilight" | "midnight" | "boss";
  selected_option_index: number;
  is_correct: number;
  feedback_json: string;
  prompt: string;
  topic_name: string;
  created_at: string;
}

function sqliteTimestampToIso(value: string): string {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Date(normalized).toISOString();
}

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

export class GameRunService {
  constructor(private readonly database: SqliteDatabase) {}

  listRuns(): RunDetail[] {
    const rows = this.database.prepare(`
      SELECT id FROM runs ORDER BY created_at DESC
    `).all() as Array<{ id: string }>;
    return rows.map((r) => this.getRun(r.id));
  }

  createRun(questionSetId: string): RunDetail {
    const questionSet = this.database.prepare(`
      SELECT id FROM question_sets WHERE id = ?
    `).get(questionSetId);
    if (!questionSet) {
      throw new NotFoundError("QUESTION_SET_NOT_FOUND", "Question set was not found.");
    }

    const questions = this.database.prepare(`
      SELECT q.id, q.question_set_id, q.topic_id, q.difficulty, q.prompt,
             q.options_json, q.answer_index, q.explanation, q.evidence_json,
             t.name as topic_name
      FROM questions_p0 q
      JOIN topics_p0 t ON q.topic_id = t.id
      WHERE q.question_set_id = ?
      ORDER BY q.rowid
    `).all(questionSetId) as QuestionRow[];

    if (questions.length !== 9) {
      throw new BadRequestError("INVALID_QUESTION_SET", "Question set must contain exactly 9 questions.");
    }

    const easyQuestions = questions.filter((q) => q.difficulty === "easy");
    const mediumQuestions = questions.filter((q) => q.difficulty === "medium");
    const hardQuestions = questions.filter((q) => q.difficulty === "hard");

    if (easyQuestions.length !== 3 || mediumQuestions.length !== 3 || hardQuestions.length !== 3) {
      throw new BadRequestError(
        "INVALID_QUESTION_SET",
        "Question set must contain exactly 3 easy, 3 medium, and 3 hard questions.",
      );
    }

    // Boss reuses all 9 questions in a shuffled order
    const bossQuestions = shuffleArray(questions);

    const runId = randomUUID();

    // Prepare 18 fixed slots
    const slotDefinitions: Array<{
      id: string;
      questionId: string;
      slotIndex: number;
      encounterType: "surface" | "twilight" | "midnight" | "boss";
    }> = [];

    // Slots 0..2: Surface (easy)
    easyQuestions.forEach((q, idx) => {
      slotDefinitions.push({
        id: randomUUID(),
        questionId: q.id,
        slotIndex: idx,
        encounterType: "surface",
      });
    });

    // Slots 3..5: Twilight (medium)
    mediumQuestions.forEach((q, idx) => {
      slotDefinitions.push({
        id: randomUUID(),
        questionId: q.id,
        slotIndex: 3 + idx,
        encounterType: "twilight",
      });
    });

    // Slots 6..8: Midnight (hard)
    hardQuestions.forEach((q, idx) => {
      slotDefinitions.push({
        id: randomUUID(),
        questionId: q.id,
        slotIndex: 6 + idx,
        encounterType: "midnight",
      });
    });

    // Slots 9..17: Boss (all 9 questions in saved shuffled order)
    bossQuestions.forEach((q, idx) => {
      slotDefinitions.push({
        id: randomUUID(),
        questionId: q.id,
        slotIndex: 9 + idx,
        encounterType: "boss",
      });
    });

    this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO runs (id, question_set_id, state, player_hp, current_encounter_hp, xp, combo, current_slot_index, rules_version)
        VALUES (?, ?, 'active', 100, 100, 0, 0, 0, ?)
      `).run(runId, questionSetId, RULES_VERSION);

      const insertSlot = this.database.prepare(`
        INSERT INTO run_slots (id, run_id, question_id, slot_index, encounter_type)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const slot of slotDefinitions) {
        insertSlot.run(slot.id, runId, slot.questionId, slot.slotIndex, slot.encounterType);
      }
    })();

    return this.getRun(runId);
  }

  getRun(id: string): RunDetail {
    const run = this.database.prepare(`
      SELECT id, question_set_id, state, player_hp, current_encounter_hp,
             xp, combo, current_slot_index, rules_version, created_at
      FROM runs WHERE id = ?
    `).get(id) as RunRow | undefined;

    if (!run) {
      throw new NotFoundError("RUN_NOT_FOUND", "Run was not found.");
    }

    let currentSlot: CurrentSlot | undefined;
    if (run.state === "active" && run.current_slot_index < 18) {
      const slot = this.database.prepare(`
        SELECT rs.id, rs.slot_index, rs.encounter_type,
               q.id as question_id, q.topic_id, q.difficulty, q.prompt, q.options_json,
               t.name as topic_name
        FROM run_slots rs
        JOIN questions_p0 q ON rs.question_id = q.id
        JOIN topics_p0 t ON q.topic_id = t.id
        WHERE rs.run_id = ? AND rs.slot_index = ?
      `).get(id, run.current_slot_index) as {
        id: string;
        slot_index: number;
        encounter_type: "surface" | "twilight" | "midnight" | "boss";
        question_id: string;
        topic_id: string;
        difficulty: "easy" | "medium" | "hard";
        prompt: string;
        options_json: string;
        topic_name: string;
      } | undefined;

      if (slot) {
        currentSlot = {
          id: slot.id,
          slotIndex: slot.slot_index,
          encounterType: slot.encounter_type,
          question: {
            id: slot.question_id,
            topicId: slot.topic_id,
            topicName: slot.topic_name,
            difficulty: slot.difficulty,
            prompt: slot.prompt,
            options: JSON.parse(slot.options_json),
          },
        };
      }
    }

    const attemptsRows = this.database.prepare(`
      SELECT ra.id, ra.slot_id, rs.slot_index, rs.encounter_type,
             ra.selected_option_index, ra.is_correct, ra.feedback_json,
             q.prompt, t.name as topic_name, ra.created_at
      FROM run_attempts ra
      JOIN run_slots rs ON ra.slot_id = rs.id
      JOIN questions_p0 q ON rs.question_id = q.id
      JOIN topics_p0 t ON q.topic_id = t.id
      WHERE ra.run_id = ?
      ORDER BY rs.slot_index ASC
    `).all(id) as AttemptRow[];

    const attempts: RunAttemptDetail[] = attemptsRows.map((row) => ({
      id: row.id,
      slotId: row.slot_id,
      slotIndex: row.slot_index,
      encounterType: row.encounter_type,
      selectedOptionIndex: row.selected_option_index,
      isCorrect: row.is_correct === 1,
      feedback: JSON.parse(row.feedback_json),
      questionPrompt: row.prompt,
      topicName: row.topic_name,
      createdAt: sqliteTimestampToIso(row.created_at),
    }));

    const latestAttempt = attempts[attempts.length - 1];

    return RunDetailSchema.parse({
      id: run.id,
      questionSetId: run.question_set_id,
      state: run.state,
      playerHp: run.player_hp,
      currentEncounterHp: run.current_encounter_hp,
      xp: run.xp,
      combo: run.combo,
      currentSlotIndex: run.current_slot_index,
      rulesVersion: run.rules_version,
      createdAt: sqliteTimestampToIso(run.created_at),
      currentSlot,
      latestFeedback: latestAttempt?.feedback,
      attempts,
    });
  }

  submitAnswer(
    runId: string,
    slotId: string,
    selectedOptionIndex: number,
  ): { feedback: AnswerFeedback; run: RunDetail } {
    if (
      typeof selectedOptionIndex !== "number" ||
      !Number.isInteger(selectedOptionIndex) ||
      selectedOptionIndex < 0 ||
      selectedOptionIndex > 3
    ) {
      throw new BadRequestError("INVALID_OPTION_INDEX", "Selected option index must be an integer between 0 and 3.");
    }

    const run = this.database.prepare(`
      SELECT id, question_set_id, state, player_hp, current_encounter_hp,
             xp, combo, current_slot_index, rules_version, created_at
      FROM runs WHERE id = ?
    `).get(runId) as RunRow | undefined;

    if (!run) {
      throw new NotFoundError("RUN_NOT_FOUND", "Run was not found.");
    }

    const slot = this.database.prepare(`
      SELECT id, run_id, question_id, slot_index, encounter_type
      FROM run_slots WHERE id = ? AND run_id = ?
    `).get(slotId, runId) as SlotRow | undefined;

    if (!slot) {
      throw new NotFoundError("SLOT_NOT_FOUND", "Slot was not found for this run.");
    }

    // Check existing attempt for idempotence and duplicate / changed answer handling
    const existingAttempt = this.database.prepare(`
      SELECT id, selected_option_index, feedback_json
      FROM run_attempts WHERE run_id = ? AND slot_id = ?
    `).get(runId, slotId) as { id: string; selected_option_index: number; feedback_json: string } | undefined;

    if (existingAttempt) {
      if (existingAttempt.selected_option_index === selectedOptionIndex) {
        // Idempotent retry: return stored feedback and current state without re-awarding damage/XP
        return {
          feedback: JSON.parse(existingAttempt.feedback_json),
          run: this.getRun(runId),
        };
      }
      throw new ConflictError("ANSWER_CONFLICT", "An answer has already been submitted for this slot.");
    }

    // Reject answers to non-active runs
    if (run.state !== "active") {
      throw new BadRequestError("RUN_NOT_ACTIVE", "Run is already finished.");
    }

    // Check slot ordering
    if (slot.slot_index !== run.current_slot_index) {
      throw new ConflictError(
        "OUT_OF_ORDER",
        `Expected answer for slot index ${run.current_slot_index}, received slot index ${slot.slot_index}.`,
      );
    }

    const question = this.database.prepare(`
      SELECT id, question_set_id, topic_id, difficulty, prompt,
             options_json, answer_index, explanation, evidence_json
      FROM questions_p0 WHERE id = ?
    `).get(slot.question_id) as QuestionRow | undefined;

    if (!question) {
      throw new NotFoundError("QUESTION_NOT_FOUND", "Question for this slot was not found.");
    }

    const isCorrect = selectedOptionIndex === question.answer_index;
    const isBoss = slot.encounter_type === "boss";

    const playerDamageTaken = isCorrect ? 0 : 50;
    const enemyDamageTaken = isCorrect ? (isBoss ? 10 : 50) : 0;
    const xpAwarded = isCorrect ? 10 : 0;

    const feedback: AnswerFeedback = {
      isCorrect,
      correctAnswerIndex: question.answer_index,
      explanation: question.explanation,
      evidence: JSON.parse(question.evidence_json),
      playerDamageTaken,
      enemyDamageTaken,
      xpAwarded,
    };

    let nextPlayerHp = Math.max(0, run.player_hp - playerDamageTaken);
    let nextEncounterHp = Math.max(0, run.current_encounter_hp - enemyDamageTaken);
    const nextXp = run.xp + xpAwarded;
    const nextCombo = isCorrect ? run.combo + 1 : 0;
    const nextSlotIndex = run.current_slot_index + 1;
    let nextState: "active" | "completed" | "failed" = "active";

    const attemptId = randomUUID();

    this.database.transaction(() => {
      // Insert attempt
      this.database.prepare(`
        INSERT INTO run_attempts (id, run_id, slot_id, selected_option_index, is_correct, feedback_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(attemptId, runId, slotId, selectedOptionIndex, isCorrect ? 1 : 0, JSON.stringify(feedback));

      // Check stage boundary transitions
      if (nextSlotIndex === 3) {
        // End of Surface (slots 0..2)
        const correctCount = this.countCorrectInSlots(runId, 0, 2);
        if (correctCount >= 2) {
          // Pass Surface -> advance to Twilight (reset HP and combo)
          nextPlayerHp = 100;
          nextEncounterHp = 100;
          nextState = "active";
        } else {
          nextState = "failed";
        }
      } else if (nextSlotIndex === 6) {
        // End of Twilight (slots 3..5)
        const correctCount = this.countCorrectInSlots(runId, 3, 5);
        if (correctCount >= 2) {
          // Pass Twilight -> advance to Midnight (reset HP and combo)
          nextPlayerHp = 100;
          nextEncounterHp = 100;
          nextState = "active";
        } else {
          nextState = "failed";
        }
      } else if (nextSlotIndex === 9) {
        // End of Midnight (slots 6..8)
        const correctCount = this.countCorrectInSlots(runId, 6, 8);
        if (correctCount >= 2) {
          // Pass Midnight -> advance to Boss (starting HP 80, player HP 100)
          nextPlayerHp = 100;
          nextEncounterHp = 80;
          nextState = "active";
        } else {
          nextState = "failed";
        }
      } else if (nextSlotIndex === 18) {
        // End of Boss (slots 9..17)
        const correctCount = this.countCorrectInSlots(runId, 9, 17);
        // Boss pass condition: >= ceil(0.8 * 9) -> 8/9 passes, 7/9 fails
        if (correctCount >= 8) {
          nextState = "completed";
        } else {
          nextState = "failed";
        }
      }

      this.database.prepare(`
        UPDATE runs
        SET state = ?, player_hp = ?, current_encounter_hp = ?, xp = ?, combo = ?, current_slot_index = ?
        WHERE id = ?
      `).run(nextState, nextPlayerHp, nextEncounterHp, nextXp, nextCombo, nextSlotIndex, runId);
    })();

    return {
      feedback,
      run: this.getRun(runId),
    };
  }

  private countCorrectInSlots(runId: string, startSlotIndex: number, endSlotIndex: number): number {
    const row = this.database.prepare(`
      SELECT COUNT(*) as count
      FROM run_attempts ra
      JOIN run_slots rs ON ra.slot_id = rs.id
      WHERE ra.run_id = ?
        AND rs.slot_index BETWEEN ? AND ?
        AND ra.is_correct = 1
    `).get(runId, startSlotIndex, endSlotIndex) as { count: number };
    return row.count;
  }
}
