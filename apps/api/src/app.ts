import express, { type ErrorRequestHandler } from "express";
import type { ApiConfig } from "./config.js";
import { ApiError } from "./errors.js";
import { createAiStatusRouter } from "./routes/ai-status.js";
import { healthRouter } from "./routes/health.js";
import { createDocumentsRouter } from "./routes/documents.js";
import { createRunsRouter } from "./routes/runs.js";
import { OllamaService } from "./services/ollama.js";
import { QuestionGeneratorService } from "./services/question-generator.js";
import { initializeDatabase, type SqliteDatabase } from "./db.js";

export function createApp(
  config: ApiConfig,
  db: SqliteDatabase = initializeDatabase(config.databasePath),
  ollama = new OllamaService(config)
) {
  const app = express();
  const generator = new QuestionGeneratorService(ollama);

  app.use(express.json({ limit: "5mb" }));
  app.use("/api/health", healthRouter);
  app.use("/api/ai/status", createAiStatusRouter(ollama));
  app.use("/api/documents", createDocumentsRouter(generator, db));
  app.use("/api/runs", createRunsRouter(db));

  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ApiError) {
      response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
      return;
    }
    console.error("[API Error]", error);
    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: error?.message || "An unexpected server error occurred.",
      },
    });
  };
  app.use(errorHandler);
  return app;
}
