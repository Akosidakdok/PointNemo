import { Router } from "express";
import type { GenerationJobService } from "../services/generation-job.js";
import { readPdfUpload } from "../services/multipart.js";

export function createDocumentRouter(jobs: GenerationJobService): Router {
  const router = Router();

  router.post("/", async (request, response, next) => {
    try {
      const file = await readPdfUpload(request);
      const result = await jobs.enqueue(file);
      response.status(202).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createJobRouter(jobs: GenerationJobService): Router {
  const router = Router();
  router.get("/:id", (request, response, next) => {
    try {
      response.json({ success: true, data: jobs.getJob(request.params.id) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export function createQuestionSetRouter(jobs: GenerationJobService): Router {
  const router = Router();
  router.get("/:id", (request, response, next) => {
    try {
      response.json({ success: true, data: jobs.getQuestionSet(request.params.id) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
