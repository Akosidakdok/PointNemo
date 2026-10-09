import { Router } from "express";
import { BadRequestError } from "../errors.js";
import { GameService } from "../services/game.js";

export function createRunsRouter(game: GameService): Router {
  const router = Router();
  router.post("/", (request, response, next) => {
    try {
      response.status(201).json(game.createRun(request.body));
    } catch (error) {
      next(error);
    }
  });
  router.get("/:runId", (request, response, next) => {
    try {
      const { runId } = request.params;
      if (typeof runId !== "string") throw new BadRequestError("INVALID_RUN_ID", "Run ID is invalid.");
      response.json(game.getRun(runId));
    } catch (error) {
      next(error);
    }
  });
  router.post("/:runId/answers", (request, response, next) => {
    try {
      const { runId } = request.params;
      if (typeof runId !== "string") throw new BadRequestError("INVALID_RUN_ID", "Run ID is invalid.");
      response.json(game.submitAnswer(runId, request.body));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
