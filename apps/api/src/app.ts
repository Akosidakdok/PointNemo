import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import type { ApiConfig } from "./config.js";
import { initializeDatabase, type SqliteDatabase } from "./db.js";
import { ApiError, BadRequestError } from "./errors.js";
import { createAiStatusRouter } from "./routes/ai-status.js";
import { createDocumentsRouter } from "./routes/documents.js";
import { createHealthRouter } from "./routes/health.js";
import { createJobsRouter } from "./routes/jobs.js";
import { createRunsRouter } from "./routes/runs.js";
import { PdfDocumentExtractor } from "./services/document-extractor.js";
import { GameService } from "./services/game.js";
import { GenerationService } from "./services/generation.js";
import { OllamaService } from "./services/ollama.js";

export function createApp(
  config: ApiConfig,
  database = initializeDatabase(config.databasePath),
  ollama = new OllamaService(config),
) {
  const app = express();
  const generation = new GenerationService(database, new PdfDocumentExtractor(), ollama);
  const game = new GameService(database);

  const trustedOrigins = new Set([
    "http://127.0.0.1:5173", "http://localhost:5173",
    "http://127.0.0.1:5174", "http://localhost:5174",
    `http://127.0.0.1:${config.port}`, `http://localhost:${config.port}`,
  ]);
  app.use((request, _response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    const origin = request.get("origin");
    if (origin && !trustedOrigins.has(origin)) {
      next(new ApiError(403, "ORIGIN_NOT_ALLOWED", "This local API accepts mutations only from the Point Nemo app."));
      return;
    }
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/health", createHealthRouter(database, ollama));
  app.use("/api/ai/status", createAiStatusRouter(ollama));
  app.use("/api/documents", createDocumentsRouter(database, generation));
  app.use("/api/jobs", createJobsRouter(generation));
  app.use("/api/runs", createRunsRouter(game));
  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found.", retryable: false } });
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof ApiError) {
      response.status(error.statusCode).json({
        error: { code: error.code, message: error.message, retryable: error.retryable },
      });
      return;
    }
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      const apiError = tooLarge
        ? new ApiError(413, "PDF_TOO_LARGE", "The PDF must be under 5 MiB.")
        : new BadRequestError("UPLOAD_INVALID", "Upload one PDF file in the file field.");
      response.status(apiError.statusCode).json({ error: { code: apiError.code, message: apiError.message, retryable: false } });
      return;
    }
    if (error instanceof ZodError) {
      response.status(400).json({ error: { code: "INVALID_REQUEST", message: "The request did not match the expected format.", retryable: false } });
      return;
    }
    if (error instanceof SyntaxError && "status" in error && error.status === 400) {
      response.status(400).json({ error: { code: "INVALID_JSON", message: "The request body contains invalid JSON.", retryable: false } });
      return;
    }
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred.", retryable: false } });
  };
  app.use(errorHandler);
  return app;
}
