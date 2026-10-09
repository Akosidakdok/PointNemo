import { Router } from "express";
import { BadRequestError } from "../errors.js";
import { GenerationService } from "../services/generation.js";

export function createJobsRouter(generation: GenerationService): Router {
  const router = Router();
  router.get("/:jobId", (request, response, next) => {
    try {
      const { jobId } = request.params;
      if (typeof jobId !== "string") throw new BadRequestError("INVALID_JOB_ID", "Job ID is invalid.");
      response.json(generation.getJob(jobId));
    } catch (error) {
      next(error);
    }
  });
  router.post("/:jobId/cancel", (request, response, next) => {
    try {
      const { jobId } = request.params;
      if (typeof jobId !== "string") throw new BadRequestError("INVALID_JOB_ID", "Job ID is invalid.");
      response.json(generation.cancelJob(jobId));
    } catch (error) {
      next(error);
    }
  });
  router.post("/:jobId/retry", (request, response, next) => {
    try {
      const { jobId } = request.params;
      if (typeof jobId !== "string") throw new BadRequestError("INVALID_JOB_ID", "Job ID is invalid.");
      response.status(202).json(generation.retryJob(jobId));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
