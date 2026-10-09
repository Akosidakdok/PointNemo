import express, { type ErrorRequestHandler } from "express";
import { existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ApiConfig } from "./config.js";
import { ApiError } from "./errors.js";
import type { SqliteDatabase } from "./db.js";
import { createAiStatusRouter } from "./routes/ai-status.js";
import { createDocumentRouter, createJobRouter, createQuestionSetRouter } from "./routes/documents.js";
import { createRunRouter } from "./routes/runs.js";
import { createHealthRouter } from "./routes/health.js";
import { GameRunService } from "./services/game-run.js";
import { GenerationJobService } from "./services/generation-job.js";
import { OllamaService } from "./services/ollama.js";

interface AppOptions {
  webDistPath?: string;
  allowDevelopmentOrigins?: boolean;
}

export function createApp(
  config: ApiConfig,
  database: SqliteDatabase,
  ollama = new OllamaService(config),
  options: AppOptions = {},
) {
  const app = express();
  app.disable("x-powered-by");
  const development = options.allowDevelopmentOrigins ?? process.env.NODE_ENV === "development";

  // Validate the actual local listener, including ephemeral ports used in tests.
  app.use((request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    const port = request.socket.localPort ?? config.port;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const host = request.headers.host;
    if (!host || !hosts.includes(host)) {
      next(new ApiError(403, "HOST_NOT_ALLOWED", "Use the local Point Nemo application address."));
      return;
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.origin;
      const allowedOrigins = [`http://${host}`];
      if (development) allowedOrigins.push("http://localhost:5173", "http://127.0.0.1:5173");
      const site = request.headers["sec-fetch-site"];
      const navigation = request.headers["sec-fetch-mode"] === "navigate" || request.headers["sec-fetch-dest"] === "document";
      if (
        (origin && !allowedOrigins.includes(origin)) ||
        (!origin && ((site && site !== "none") || navigation))
      ) {
        next(new ApiError(403, "ORIGIN_NOT_ALLOWED", "Make changes from the local Point Nemo application."));
        return;
      }
    }
    next();
  });
  app.use("/api", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.use("/api/health", createHealthRouter(database, ollama));
  app.use("/api/ai/status", createAiStatusRouter(ollama));
  const jobs = new GenerationJobService(database, config, undefined, ollama);
  const gameRuns = new GameRunService(database);
  app.use("/api/documents", createDocumentRouter(jobs));
  app.use("/api/jobs", createJobRouter(jobs));
  app.use("/api/question-sets", createQuestionSetRouter(jobs));
  app.use("/api/runs", createRunRouter(gameRuns, jobs));
  const notFound = (_request: express.Request, response: express.Response) => {
    response.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found.", retryable: false },
    });
  };
  app.use("/api", notFound);

  const webDistPath = options.webDistPath ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
  const indexPath = join(webDistPath, "index.html");
  if (existsSync(indexPath)) {
    app.use(express.static(webDistPath, { index: false, redirect: false, dotfiles: "deny" }));
    app.use((request, response, next) => {
      if (["GET", "HEAD"].includes(request.method) && !extname(request.path) && request.accepts("html")) {
        response.sendFile(indexPath, (error) => { if (error) next(error); });
        return;
      }
      next();
    });
  }
  app.use(notFound);

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (response.headersSent) { response.destroy(); return; }
    if (error instanceof ApiError) {
      response.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.statusCode >= 500 && error.code !== "GENERATION_BUSY"
            ? "The local service could not complete this request. Check local readiness and retry."
            : error.message,
          retryable: error.statusCode >= 500 || error.code === "GENERATION_BUSY",
        },
      });
      return;
    }
    if (error?.type === "entity.parse.failed" || error?.type === "entity.too.large") {
      const oversized = error.type === "entity.too.large";
      response.status(oversized ? 413 : 400).json({
        success: false,
        error: {
          code: oversized ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
          message: oversized ? "The request body is too large." : "Send a valid JSON request body.",
          retryable: false,
        },
      });
      return;
    }
    response.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected local service error occurred.",
        retryable: true,
      },
    });
  };
  app.use(errorHandler);
  return app;
}
