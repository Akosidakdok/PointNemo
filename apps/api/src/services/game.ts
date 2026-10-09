import { randomInt, randomUUID } from "node:crypto";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.js";
import { type SqliteDatabase } from "../db.js";
import { CreateRunRequestSchema, SubmitAnswerRequestSchema } from "@point-nemo/shared";
import { GAME_RULES_VERSION } from "./generation.js";

const stages = ["surface", "twilight", "midnight", "boss"] as const;
type Stage = typeof stages[number];
type RunStatus = "active" | "failed" | "completed";

interface RunRow {
  id: string;
  question_set_id: string;
  rules_version: string;
  status: RunStatus;
  current_stage: string;
  player_hp: number;
  enemy_hp: number;
  combo: number;
  xp: number;
  badge_awarded: number;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

interface SlotQuestion {
  id: string;
  topic_id: string;
  topic_title: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options_json: string;
  correct_option_index: number;
  explanation: string;
  evidence_page: number;
  evidence_quote: string;
  topic_ordinal: number;
  question_ordinal: number;
}

function stageForDifficulty(difficulty: SlotQuestion["difficulty"]): Stage {
  if (difficulty === "easy") return "surface";
  if (difficulty === "medium") return "twilight";
  return "midnight";
}

function shuffle<T>(input: T[]): T[] {
  const values = [...input];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [values[index], values[other]] = [values[other], values[index]];
  }
  return values;
}

function safeJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export class GameService {
  constructor(private readonly database: SqliteDatabase) {}

  createRun(input: unknown) {
    const parsed = CreateRunRequestSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestError("INVALID_RUN_REQUEST", "Provide a valid questionSetId to start a run.");
    const { questionSetId } = parsed.data;
    const active = this.database.prepare("SELECT id FROM runs WHERE status = 'active' LIMIT 1").get();
    if (active) throw new ConflictError("RUN_ALREADY_ACTIVE", "Resume or finish the active run before starting another.");
    const set = this.database.prepare("SELECT id, rules_version FROM question_sets WHERE id = ? AND state = 'ready'").get(questionSetId) as { id: string; rules_version: string } | undefined;
    if (!set) throw new NotFoundError("QUESTION_SET_NOT_FOUND", "A validated question set with that ID was not found.");
    if (set.rules_version !== GAME_RULES_VERSION) throw new ConflictError("RULES_VERSION_UNSUPPORTED", "This question set uses a game-rules version that this app cannot start.");

    const questions = this.database.prepare(`
      SELECT q.id, q.topic_id, t.title AS topic_title, q.difficulty, q.prompt, q.options_json,
             q.correct_option_index, q.explanation, q.evidence_page, q.evidence_quote,
             t.ordinal AS topic_ordinal, q.ordinal AS question_ordinal
      FROM mvp_questions q JOIN question_set_topics t ON t.id = q.topic_id
      WHERE q.question_set_id = ? ORDER BY q.ordinal
    `).all(questionSetId) as SlotQuestion[];
    if (questions.length !== 9) throw new ConflictError("QUESTION_SET_INCOMPLETE", "A run requires exactly nine validated questions.");

    const runId = randomUUID();
    const stagesToQuestions = new Map<Stage, SlotQuestion[]>(stages.map((stage) => [stage, []]));
    for (const question of questions) stagesToQuestions.get(stageForDifficulty(question.difficulty))?.push(question);
    if (stages.slice(0, 3).some((stage) => stagesToQuestions.get(stage)?.length !== 3)) {
      throw new ConflictError("QUESTION_SET_COVERAGE_INVALID", "The question set does not have three questions for each depth zone.");
    }

    const transaction = this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO runs (id, question_set_id, rules_version, status, current_stage, player_hp, enemy_hp, combo, xp)
        VALUES (?, ?, ?, 'active', 'surface', 100, 100, 0, 0)
      `).run(runId, questionSetId, GAME_RULES_VERSION);
      for (const stage of stages.slice(0, 3)) {
        const zoneQuestions = [...(stagesToQuestions.get(stage) ?? [])].sort((left, right) => left.topic_ordinal - right.topic_ordinal);
        zoneQuestions.forEach((question, ordinal) => {
          this.database.prepare("INSERT INTO run_slots (id, run_id, question_id, stage, ordinal) VALUES (?, ?, ?, ?, ?)")
            .run(randomUUID(), runId, question.id, stage, ordinal);
        });
      }
      shuffle(questions).forEach((question, ordinal) => {
        this.database.prepare("INSERT INTO run_slots (id, run_id, question_id, stage, ordinal) VALUES (?, ?, ?, 'boss', ?)")
          .run(randomUUID(), runId, question.id, ordinal);
      });
    });
    transaction();
    return this.getRun(runId);
  }

  getRun(runId: string) {
    const run = this.database.prepare(`
      SELECT id, question_set_id, rules_version, status, current_stage, player_hp, enemy_hp,
             combo, xp, badge_awarded, created_at, updated_at, finished_at
      FROM runs WHERE id = ?
    `).get(runId) as RunRow | undefined;
    if (!run) throw new NotFoundError("RUN_NOT_FOUND", "The run was not found.");

    const currentQuestion = run.status === "active" ? this.database.prepare(`
      SELECT s.id AS slot_id, s.ordinal, q.id AS question_id, q.prompt, q.options_json,
             q.difficulty, t.title AS topic_title
      FROM run_slots s JOIN mvp_questions q ON q.id = s.question_id
      JOIN question_set_topics t ON t.id = q.topic_id
      LEFT JOIN run_attempts a ON a.run_id = s.run_id AND a.slot_id = s.id
      WHERE s.run_id = ? AND s.stage = ? AND a.id IS NULL
      ORDER BY s.ordinal LIMIT 1
    `).get(runId, run.current_stage) as {
      slot_id: string; ordinal: number; question_id: string; prompt: string; options_json: string; difficulty: string; topic_title: string;
    } | undefined : undefined;

    const latestAttempt = this.database.prepare(`
      SELECT feedback_json FROM run_attempts WHERE run_id = ? ORDER BY attempted_at DESC, rowid DESC LIMIT 1
    `).get(runId) as { feedback_json: string } | undefined;
    const stageScores = this.database.prepare(`
      SELECT s.stage AS stage, COUNT(a.id) AS answered, SUM(COALESCE(a.is_correct, 0)) AS correct,
             COUNT(s.id) AS total
      FROM run_slots s LEFT JOIN run_attempts a ON a.run_id = s.run_id AND a.slot_id = s.id
      WHERE s.run_id = ? GROUP BY s.stage
    `).all(runId) as Array<{ stage: string; answered: number; correct: number | null; total: number }>;

    return {
      run: {
        id: run.id,
        questionSetId: run.question_set_id,
        rulesVersion: run.rules_version,
        status: run.status,
        stage: run.current_stage,
        playerHp: run.player_hp,
        enemyHp: run.enemy_hp,
        combo: run.combo,
        xp: run.xp,
        badgeAwarded: Boolean(run.badge_awarded),
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        finishedAt: run.finished_at,
      },
      currentQuestion: currentQuestion ? {
        slotId: currentQuestion.slot_id,
        slotNumber: currentQuestion.ordinal + 1,
        questionId: currentQuestion.question_id,
        prompt: currentQuestion.prompt,
        options: safeJson<string[]>(currentQuestion.options_json, []),
        difficulty: currentQuestion.difficulty,
        topic: currentQuestion.topic_title,
      } : null,
      latestFeedback: latestAttempt ? safeJson<unknown>(latestAttempt.feedback_json, null) : null,
      stageScores: stageScores.map((score) => ({ stage: score.stage, answered: score.answered, correct: score.correct ?? 0, total: score.total })),
    };
  }

  submitAnswer(runId: string, input: unknown) {
    const parsed = SubmitAnswerRequestSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestError("INVALID_ANSWER", "Provide a slotId and an answer option from 0 to 3.");
    const { slotId, selectedOptionIndex } = parsed.data;
    const transaction = this.database.transaction(() => {
      const run = this.database.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as RunRow | undefined;
      if (!run) throw new NotFoundError("RUN_NOT_FOUND", "The run was not found.");

      // Resolve a duplicate before checking completion so a retry of the final slot is idempotent.
      const prior = this.database.prepare("SELECT feedback_json FROM run_attempts WHERE run_id = ? AND slot_id = ?").get(runId, slotId) as { feedback_json: string } | undefined;
      if (prior) return safeJson<unknown>(prior.feedback_json, null);
      if (run.status !== "active") throw new ConflictError("RUN_NOT_ACTIVE", "This run has ended. Start a new run to try again.");

      const slot = this.database.prepare(`
        SELECT s.id AS slot_id, s.question_id, s.stage, s.ordinal, q.prompt, q.options_json,
               q.correct_option_index, q.explanation, q.evidence_page, q.evidence_quote
        FROM run_slots s JOIN mvp_questions q ON q.id = s.question_id
        WHERE s.run_id = ? AND s.id = ?
      `).get(runId, slotId) as {
        slot_id: string; question_id: string; stage: Stage; ordinal: number; prompt: string; options_json: string;
        correct_option_index: number; explanation: string; evidence_page: number; evidence_quote: string;
      } | undefined;
      if (!slot) throw new NotFoundError("RUN_SLOT_NOT_FOUND", "That question slot does not belong to this run.");
      if (slot.stage !== run.current_stage) throw new ConflictError("ANSWER_OUT_OF_ORDER", "Answer the current question before submitting another.");
      const current = this.database.prepare(`
        SELECT s.id FROM run_slots s LEFT JOIN run_attempts a ON a.run_id = s.run_id AND a.slot_id = s.id
        WHERE s.run_id = ? AND s.stage = ? AND a.id IS NULL ORDER BY s.ordinal LIMIT 1
      `).get(runId, run.current_stage) as { id: string } | undefined;
      if (current?.id !== slotId) throw new ConflictError("ANSWER_OUT_OF_ORDER", "Answer the current question before submitting another.");

      const options = safeJson<string[]>(slot.options_json, []);
      if (selectedOptionIndex >= options.length) throw new ConflictError("ANSWER_OPTION_INVALID", "Choose one of the available answers.");
      const correct = selectedOptionIndex === slot.correct_option_index;
      const enemyDamage = correct ? (slot.stage === "boss" ? 10 : 50) : 0;
      const playerDamage = correct ? 0 : 50;
      const playerHp = Math.max(0, run.player_hp - playerDamage);
      const enemyHp = Math.max(0, run.enemy_hp - enemyDamage);
      const xp = run.xp + (correct ? 10 : 0);
      const combo = correct ? run.combo + 1 : 0;
      const optionsLeft = this.database.prepare(`
        SELECT COUNT(*) AS count FROM run_slots s LEFT JOIN run_attempts a ON a.run_id = s.run_id AND a.slot_id = s.id
        WHERE s.run_id = ? AND s.stage = ? AND a.id IS NULL
      `).get(runId, slot.stage) as { count: number };
      const finalQuestion = optionsLeft.count === 1;
      let status: RunStatus = run.status;
      let stage: RunRow["current_stage"] = run.current_stage;
      let finalPlayerHp = playerHp;
      let finalEnemyHp = enemyHp;
      let finalCombo = combo;
      let badgeAwarded = run.badge_awarded;
      let finished = false;
      let passed: boolean | null = null;
      let stageCorrect: number | null = null;

      if (finalQuestion) {
        const earlierCorrect = this.database.prepare(`
          SELECT COUNT(*) AS count FROM run_attempts a JOIN run_slots s ON s.id = a.slot_id
          WHERE a.run_id = ? AND s.stage = ? AND a.is_correct = 1
        `).get(runId, slot.stage) as { count: number };
        stageCorrect = earlierCorrect.count + (correct ? 1 : 0);
        const required = slot.stage === "boss" ? 8 : 2;
        passed = stageCorrect >= required;
        if (!passed) {
          status = "failed";
          stage = "failed";
          finished = true;
        } else if (slot.stage === "boss") {
          status = "completed";
          stage = "complete";
          badgeAwarded = 1;
          finished = true;
        } else {
          const nextStage = stages[stages.indexOf(slot.stage) + 1];
          stage = nextStage;
          finalPlayerHp = 100;
          finalEnemyHp = nextStage === "boss" ? 80 : 100;
          finalCombo = 0;
        }
      }

      const feedback = {
        isCorrect: correct,
        selectedOptionIndex,
        correctOptionIndex: slot.correct_option_index,
        correctAnswer: options[slot.correct_option_index],
        explanation: slot.explanation,
        evidence: { page: slot.evidence_page, quote: slot.evidence_quote },
        effects: { enemyDamage, playerDamage, xpAwarded: correct ? 10 : 0 },
        stageResult: finalQuestion ? { stage: slot.stage, correct: stageCorrect, total: slot.stage === "boss" ? 9 : 3, passed } : null,
      };
      this.database.prepare(`
        INSERT INTO run_attempts (id, run_id, slot_id, selected_option_index, is_correct, feedback_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), runId, slotId, selectedOptionIndex, correct ? 1 : 0, JSON.stringify(feedback));
      this.database.prepare(`
        UPDATE runs SET status = ?, current_stage = ?, player_hp = ?, enemy_hp = ?, combo = ?, xp = ?,
          badge_awarded = ?, updated_at = CURRENT_TIMESTAMP,
          finished_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = ?
      `).run(status, stage, finalPlayerHp, finalEnemyHp, finalCombo, xp, badgeAwarded, finished ? 1 : 0, runId);
      return feedback;
    });
    const feedback = transaction();
    return { feedback, ...this.getRun(runId) };
  }
}
