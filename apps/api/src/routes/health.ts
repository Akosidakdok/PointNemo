import { Router } from "express";
import type { SqliteDatabase } from "../db.js";
import type { OllamaService } from "../services/ollama.js";

export function createHealthRouter(database: SqliteDatabase, ollama: OllamaService): Router {
  const router = Router();
  router.get("/", async (_request, response) => {
    let databaseReady = false;
    try {
      database.prepare("SELECT 1").get();
      databaseReady = true;
    } catch { /* Report readiness without exposing paths or database errors. */ }
    try {
      const local = await ollama.getStatus();
      const ready = databaseReady && local.available && local.tokenizerReady;
      response.status(ready ? 200 : 503).json({
        status: ready ? "ok" : "degraded",
        ready,
        app: { available: true },
        database: { available: databaseReady },
        ollama: { available: local.available, model: local.model, digest: local.digest },
        tokenizer: { available: local.tokenizerReady, digest: local.tokenizerDigest },
        message: ready ? "Local application is ready." : "Check the local database, pinned model, and tokenizer setup.",
      });
    } catch {
      response.status(503).json({
        status: "degraded", ready: false,
        app: { available: true }, database: { available: databaseReady },
        ollama: { available: false }, tokenizer: { available: false },
        message: "Local model/tokenizer readiness could not be checked.",
      });
    }
  });
  return router;
}
