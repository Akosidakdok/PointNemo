import express, { type ErrorRequestHandler } from "express";
import type { ApiConfig } from "./config.js";
import { ApiError } from "./errors.js";
import type { SqliteDatabase } from "./db.js";
import { createAiStatusRouter } from "./routes/ai-status.js";
import { createDocumentRouter, createJobRouter, createQuestionSetRouter } from "./routes/documents.js";
import { createRunRouter } from "./routes/runs.js";
import { healthRouter } from "./routes/health.js";
import { GameRunService } from "./services/game-run.js";
import { GenerationJobService } from "./services/generation-job.js";
import { OllamaService } from "./services/ollama.js";

export function createApp(
  config: ApiConfig,
  database: SqliteDatabase,
  ollama = new OllamaService(config),
) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/health", healthRouter);
  app.use("/api/ai/status", createAiStatusRouter(ollama));
  const jobs = new GenerationJobService(database, config, undefined, ollama);
  const gameRuns = new GameRunService(database);
  app.use("/api/documents", createDocumentRouter(jobs));
  app.use("/api/jobs", createJobRouter(jobs));
  app.use("/api/question-sets", createQuestionSetRouter(jobs));
  app.use("/api/runs", createRunRouter(gameRuns));
  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ApiError) {
      response.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.statusCode >= 500 || error.code === "GENERATION_BUSY",
        },
      });
      return;
    }
    response.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred.", retryable: true },
    });
  };
  app.use(errorHandler);
  return app;
}
