import express, { type ErrorRequestHandler } from "express";
import type { ApiConfig } from "./config.js";
import { ApiError } from "./errors.js";
import type { SqliteDatabase } from "./db.js";
import { createAiStatusRouter } from "./routes/ai-status.js";
import { healthRouter } from "./routes/health.js";
import { OllamaService } from "./services/ollama.js";

export function createApp(
  config: ApiConfig,
  _database: SqliteDatabase,
  ollama = new OllamaService(config),
) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/health", healthRouter);
  app.use("/api/ai/status", createAiStatusRouter(ollama));
  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ApiError) {
      response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
      return;
    }
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." } });
  };
  app.use(errorHandler);
  return app;
}
