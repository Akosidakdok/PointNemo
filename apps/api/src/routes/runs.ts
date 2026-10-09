import { Router } from "express";
import { type SqliteDatabase } from "../db.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { randomUUID } from "node:crypto";
import {
  type DescentRun,
  type QuestionSet,
  type DescentZone,
  type PointNemoQuestion,
} from "@point-nemo/shared";

export function createRunsRouter(db: SqliteDatabase) {
  const router = Router();

  // Helper to map DB row to DescentRun
  function mapRunRow(row: any): DescentRun {
    return {
      id: row.id,
      questionSetId: row.question_set_id,
      documentName: row.document_name,
      stage: row.stage as DescentZone,
      status: row.status,
      currentQuestionIndex: row.current_question_index,
      playerHp: row.player_hp,
      enemyHp: row.enemy_hp,
      xp: row.xp,
      shuffledBossOrder: JSON.parse(row.shuffled_boss_order_json),
      attempts: JSON.parse(row.attempts_json),
      zoneScores: JSON.parse(row.zone_scores_json),
      failureReason: row.failure_reason ?? undefined,
      completedAt: row.completed_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapQuestionSetRow(row: any): QuestionSet {
    return {
      id: row.id,
      documentName: row.document_name,
      topics: JSON.parse(row.topics_json),
      questions: JSON.parse(row.questions_json),
      extractedPages: JSON.parse(row.extracted_pages_json),
      createdAt: row.created_at,
    };
  }

  // GET /api/runs - list all runs
  router.get("/", (_req, res) => {
    const rows = db.prepare("SELECT * FROM runs ORDER BY updated_at DESC").all();
    const runs = rows.map(mapRunRow);

    // Also fetch distinct question sets
    const qsRows = db.prepare("SELECT * FROM question_sets ORDER BY created_at DESC").all();
    const questionSets = qsRows.map(mapQuestionSetRow);

    res.json({ runs, questionSets });
  });

  // GET /api/runs/:id - fetch specific run with question set
  router.get("/:id", (req, res) => {
    const runRow = db.prepare("SELECT * FROM runs WHERE id = ?").get(req.params.id);
    if (!runRow) {
      throw new NotFoundError("Run not found.");
    }
    const run = mapRunRow(runRow);

    const qsRow = db.prepare("SELECT * FROM question_sets WHERE id = ?").get(run.questionSetId);
    if (!qsRow) {
      throw new NotFoundError("Associated question set not found.");
    }
    const questionSet = mapQuestionSetRow(qsRow);

    res.json({ run, questionSet });
  });

  // POST /api/runs/:id/answer - submit answer for current question
  router.post("/:id/answer", (req, res) => {
    const runRow = db.prepare("SELECT * FROM runs WHERE id = ?").get(req.params.id);
    if (!runRow) throw new NotFoundError("Run not found.");
    const run = mapRunRow(runRow);

    if (run.status !== "active") {
      throw new ValidationError("Cannot answer questions on an inactive run.");
    }

    const qsRow = db.prepare("SELECT * FROM question_sets WHERE id = ?").get(run.questionSetId);
    if (!qsRow) throw new NotFoundError("Question set not found.");
    const questionSet = mapQuestionSetRow(qsRow);

    const { selectedAnswer } = req.body;
    if (![0, 1, 2, 3].includes(selectedAnswer)) {
      throw new ValidationError("selectedAnswer must be 0, 1, 2, or 3.");
    }

    // Determine current active question
    let activeQuestion: PointNemoQuestion;
    const stage = run.stage;

    if (stage === "surface") {
      const surfaceQuestions = questionSet.questions.filter((q: PointNemoQuestion) => q.difficulty === "easy");
      activeQuestion = surfaceQuestions[run.currentQuestionIndex];
    } else if (stage === "twilight") {
      const twilightQuestions = questionSet.questions.filter((q: PointNemoQuestion) => q.difficulty === "medium");
      activeQuestion = twilightQuestions[run.currentQuestionIndex];
    } else if (stage === "midnight") {
      const midnightQuestions = questionSet.questions.filter((q: PointNemoQuestion) => q.difficulty === "hard");
      activeQuestion = midnightQuestions[run.currentQuestionIndex];
    } else if (stage === "boss") {
      const qId = run.shuffledBossOrder[run.currentQuestionIndex];
      activeQuestion = questionSet.questions.find((q: PointNemoQuestion) => q.id === qId)!;
    } else {
      throw new ValidationError("Run is already in results stage.");
    }

    if (!activeQuestion) {
      throw new ValidationError("Invalid question index for current stage.");
    }

    // Evaluate answer
    const isCorrect = selectedAnswer === activeQuestion.answerIndex;
    if (isCorrect) {
      run.enemyHp = Math.max(0, run.enemyHp - 50);
      run.xp += 10;
    } else {
      run.playerHp = Math.max(0, run.playerHp - 50);
    }

    // Record attempt
    run.attempts.push({
      questionId: activeQuestion.id,
      slotIndex: run.attempts.length,
      zone: stage,
      selectedAnswer,
      isCorrect,
      answeredAt: new Date().toISOString(),
    });

    // Advance within stage or evaluate stage threshold
    const stageAttempts = run.attempts.filter((a: any) => a.zone === stage);

    if (stage === "surface" || stage === "twilight" || stage === "midnight") {
      if (stageAttempts.length < 3) {
        // Move to next question within zone
        run.currentQuestionIndex += 1;
      } else {
        // Zone complete! Evaluate score (all 3 questions answered)
        const zoneCorrect = stageAttempts.filter((a: any) => a.isCorrect).length;
        run.zoneScores[stage] = zoneCorrect;

        if (zoneCorrect >= 2) {
          // Pass! Transition to next zone
          if (stage === "surface") {
            run.stage = "twilight";
          } else if (stage === "twilight") {
            run.stage = "midnight";
          } else if (stage === "midnight") {
            run.stage = "boss";
          }
          run.currentQuestionIndex = 0;
          run.playerHp = 100;
          run.enemyHp = 100;
        } else {
          // Fail! End descent immediately
          run.status = "failed";
          run.stage = "results";
          run.failureReason = `${stage.charAt(0).toUpperCase() + stage.slice(1)} Zone requires at least 2 correct answers (scored ${zoneCorrect}/3).`;
          run.completedAt = new Date().toISOString();
        }
      }
    } else if (stage === "boss") {
      if (stageAttempts.length < 9) {
        run.currentQuestionIndex += 1;
      } else {
        // Boss complete! All 9 questions answered
        const bossCorrect = stageAttempts.filter((a: any) => a.isCorrect).length;
        run.zoneScores.boss = bossCorrect;

        if (bossCorrect >= 8) {
          // Boss cleared! Award descent complete
          run.status = "completed";
          run.stage = "results";
          run.completedAt = new Date().toISOString();
        } else {
          // Boss failed!
          run.status = "failed";
          run.stage = "results";
          run.failureReason = `Point Nemo Boss requires at least 8 correct answers (scored ${bossCorrect}/9).`;
          run.completedAt = new Date().toISOString();
        }
      }
    }

    run.updatedAt = new Date().toISOString();

    // Persist to SQLite
    db.prepare(
      `UPDATE runs SET
        stage = ?, status = ?, current_question_index = ?,
        player_hp = ?, enemy_hp = ?, xp = ?, attempts_json = ?,
        zone_scores_json = ?, failure_reason = ?, completed_at = ?,
        updated_at = ?
       WHERE id = ?`
    ).run(
      run.stage,
      run.status,
      run.currentQuestionIndex,
      run.playerHp,
      run.enemyHp,
      run.xp,
      JSON.stringify(run.attempts),
      JSON.stringify(run.zoneScores),
      run.failureReason ?? null,
      run.completedAt ?? null,
      run.updatedAt,
      run.id
    );

    res.json({ run, lastAnswer: { isCorrect, activeQuestion, selectedAnswer } });
  });

  // POST /api/runs/:id/try-again - create new run with SAME question set
  router.post("/:id/try-again", (req, res) => {
    const oldRunRow = db.prepare("SELECT * FROM runs WHERE id = ?").get(req.params.id);
    if (!oldRunRow) throw new NotFoundError("Run not found.");
    const oldRun = mapRunRow(oldRunRow);

    const qsRow = db.prepare("SELECT * FROM question_sets WHERE id = ?").get(oldRun.questionSetId);
    if (!qsRow) throw new NotFoundError("Question set not found.");
    const questionSet = mapQuestionSetRow(qsRow);

    // New shuffled boss order
    const questionIds = questionSet.questions.map((q: any) => q.id);
    const shuffledBossOrder = [...questionIds].sort(() => Math.random() - 0.5);

    const newRunId = randomUUID();
    const now = new Date().toISOString();

    const newRun: DescentRun = {
      id: newRunId,
      questionSetId: questionSet.id,
      documentName: questionSet.documentName,
      stage: "surface",
      status: "active",
      currentQuestionIndex: 0,
      playerHp: 100,
      enemyHp: 100,
      xp: 0,
      shuffledBossOrder,
      attempts: [],
      zoneScores: {
        surface: 0,
        twilight: 0,
        midnight: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(
      `INSERT INTO runs (
        id, question_set_id, document_name, stage, status,
        current_question_index, player_hp, enemy_hp, xp,
        shuffled_boss_order_json, attempts_json, zone_scores_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newRun.id,
      newRun.questionSetId,
      newRun.documentName,
      newRun.stage,
      newRun.status,
      newRun.currentQuestionIndex,
      newRun.playerHp,
      newRun.enemyHp,
      newRun.xp,
      JSON.stringify(newRun.shuffledBossOrder),
      JSON.stringify(newRun.attempts),
      JSON.stringify(newRun.zoneScores),
      newRun.createdAt,
      newRun.updatedAt
    );

    res.json({ run: newRun, questionSet });
  });

  // DELETE /api/runs/:id - delete run and associated materials
  router.delete("/:id", (req, res) => {
    const runRow = db.prepare("SELECT * FROM runs WHERE id = ?").get(req.params.id);
    if (!runRow) throw new NotFoundError("Run not found.");
    const run = mapRunRow(runRow);

    // Delete question set (cascades runs)
    db.prepare("DELETE FROM question_sets WHERE id = ?").run(run.questionSetId);
    db.prepare("DELETE FROM runs WHERE id = ?").run(run.id);

    res.json({ success: true, deletedRunId: run.id });
  });

  return router;
}
