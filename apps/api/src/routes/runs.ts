import { Router } from "express";
import { CreateRunRequestSchema, SubmitAnswerRequestSchema } from "@point-nemo/shared";
import { BadRequestError } from "../errors.js";
import type { GameRunService } from "../services/game-run.js";

export function createRunRouter(gameRuns: GameRunService): Router {
  const router = Router();

  router.post("/", (request, response, next) => {
    try {
      const parsed = CreateRunRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError("INVALID_INPUT", "A valid questionSetId (UUID) is required to start a run.");
      }
      const run = gameRuns.createRun(parsed.data.questionSetId);
      response.status(201).json({ success: true, data: run });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", (request, response, next) => {
    try {
      const run = gameRuns.getRun(request.params.id);
      response.status(200).json({ success: true, data: run });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/answers", (request, response, next) => {
    try {
      const parsed = SubmitAnswerRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError(
          "INVALID_INPUT",
          "A valid slotId (UUID) and selectedOptionIndex (integer between 0 and 3) are required.",
        );
      }
      const result = gameRuns.submitAnswer(
        request.params.id,
        parsed.data.slotId,
        parsed.data.selectedOptionIndex,
      );
      response.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
