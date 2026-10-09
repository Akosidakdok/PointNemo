import { Router } from "express";
import type { SqliteDatabase } from "../db.js";
import type { OllamaService } from "../services/ollama.js";

export function createHealthRouter(database: SqliteDatabase, ollama: OllamaService): Router {
  const router = Router();
  router.get("/", async (_request, response) => {
    database.prepare("SELECT 1").get();
    response.json({ status: "ok", database: "ok", model: await ollama.getStatus() });
  });
  return router;
}
