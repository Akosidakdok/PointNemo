import { Router } from "express";
import multer from "multer";
import { LocalPdfExtractor } from "../services/document-extractor.js";
import { type QuestionGeneratorService } from "../services/question-generator.js";
import { type SqliteDatabase } from "../db.js";
import { ValidationError } from "../errors.js";
import { randomUUID } from "node:crypto";
import {
  ExtractedDocumentSchema,
  type DescentRun,
  type QuestionSet,
} from "@point-nemo/shared";

const upload = multer({
  limits: {
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
    } else {
      cb(new ValidationError("Only PDF files are supported in this MVP."));
    }
  },
});

export function createDocumentsRouter(
  generator: QuestionGeneratorService,
  db: SqliteDatabase
) {
  const router = Router();
  const extractor = new LocalPdfExtractor();

  // POST /api/documents/extract
  router.post("/extract", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) {
        throw new ValidationError("No PDF file was provided.");
      }

      const extracted = await extractor.extractText({
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
        size: req.file.size,
      });

      res.json({ document: extracted });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/documents/generate
  router.post("/generate", async (req, res, next) => {
    try {
      const parsedDoc = ExtractedDocumentSchema.safeParse(req.body.document);
      if (!parsedDoc.success) {
        throw new ValidationError("Invalid extracted document payload.");
      }

      const questionSet = await generator.generateAndValidate(parsedDoc.data);

      // Save question set to SQLite
      db.prepare(
        `INSERT INTO question_sets (id, document_name, topics_json, questions_json, extracted_pages_json)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        questionSet.id,
        questionSet.documentName,
        JSON.stringify(questionSet.topics),
        JSON.stringify(questionSet.questions),
        JSON.stringify(questionSet.extractedPages)
      );

      // Create initial run with shuffled boss order (shuffle of 0..8 indices)
      const questionIds = questionSet.questions.map((q: any) => q.id);
      const shuffledBossOrder = [...questionIds].sort(() => Math.random() - 0.5);

      const runId = randomUUID();
      const now = new Date().toISOString();

      const run: DescentRun = {
        id: runId,
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
        run.id,
        run.questionSetId,
        run.documentName,
        run.stage,
        run.status,
        run.currentQuestionIndex,
        run.playerHp,
        run.enemyHp,
        run.xp,
        JSON.stringify(run.shuffledBossOrder),
        JSON.stringify(run.attempts),
        JSON.stringify(run.zoneScores),
        run.createdAt,
        run.updatedAt
      );

      res.json({ questionSet, run });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
