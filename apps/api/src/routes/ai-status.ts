import { Router } from "express";
import type { OllamaService } from "../services/ollama.js";

export function createAiStatusRouter(ollama: OllamaService): Router {
  const router = Router();
  router.get("/", async (_request, response, next) => {
    try {
      response.json(await ollama.getStatus());
    } catch (error) {
      next(error);
    }
  });
  return router;
}
