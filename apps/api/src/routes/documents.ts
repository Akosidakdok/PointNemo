import { Router } from "express";
import multer from "multer";
import type { SqliteDatabase } from "../db.js";
import { BadRequestError, NotFoundError } from "../errors.js";
import { MAX_PDF_BYTES } from "../services/document-extractor.js";
import { GenerationService } from "../services/generation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 0, parts: 1 },
});

function assertPdfUpload(file: Express.Multer.File): void {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d];
  const headerMatches = file.buffer.byteLength >= signature.length
    && file.buffer.subarray(0, signature.length).every((byte, index) => byte === signature[index]);
  if (!file.originalname.toLowerCase().endsWith(".pdf") || !headerMatches) {
    throw new BadRequestError("PDF_INVALID", "Upload a valid PDF file.");
  }
  if (file.size >= MAX_PDF_BYTES) {
    throw new BadRequestError("PDF_TOO_LARGE", "The PDF must be under 5 MiB.");
  }
}

export function createDocumentsRouter(database: SqliteDatabase, generation: GenerationService): Router {
  const router = Router();

  router.get("/", (_request, response) => {
    const documents = database.prepare(`
      SELECT d.id, d.source_name AS sourceName, d.source_sha256 AS sourceSha256,
             d.page_count AS pageCount, d.normalized_chars AS normalizedChars, d.created_at AS createdAt,
             (SELECT j.state FROM generation_jobs j WHERE j.document_id = d.id ORDER BY j.created_at DESC LIMIT 1) AS latestJobState,
             (SELECT j.id FROM generation_jobs j WHERE j.document_id = d.id ORDER BY j.created_at DESC LIMIT 1) AS latestJobId
      FROM documents d ORDER BY d.created_at DESC
    `).all() as Array<Record<string, unknown> & { id: string }>;

    const list = documents.map((document) => ({
      ...document,
      questionSets: database.prepare(`
        SELECT id, state, model_name AS model, created_at AS createdAt,
               (SELECT COUNT(*) FROM mvp_questions q WHERE q.question_set_id = question_sets.id) AS questionCount
        FROM question_sets WHERE document_id = ? ORDER BY created_at DESC
      `).all(document.id),
      runs: database.prepare(`
        SELECT id, status, current_stage AS stage, xp, badge_awarded AS badgeAwarded, updated_at AS updatedAt
        FROM runs WHERE question_set_id IN (SELECT id FROM question_sets WHERE document_id = ?)
        ORDER BY created_at DESC
      `).all(document.id),
    }));
    response.json({ documents: list });
  });

  router.post("/", upload.single("file"), (request, response, next) => {
    try {
      if (!request.file) throw new BadRequestError("PDF_REQUIRED", "Choose one PDF file to upload.");
      assertPdfUpload(request.file);
      const result = generation.acceptUpload({
        originalName: request.file.originalname,
        mimeType: request.file.mimetype,
        buffer: request.file.buffer,
      });
      response.status(202).json({ ...result, state: "extracting" });
    } catch (error) {
      next(error);
    } finally {
      request.file?.buffer.fill(0);
    }
  });

  router.delete("/:documentId", (request, response, next) => {
    try {
      const { documentId } = request.params;
      if (typeof documentId !== "string") throw new BadRequestError("INVALID_DOCUMENT_ID", "Document ID is invalid.");
      const exists = database.prepare("SELECT id FROM documents WHERE id = ?").get(documentId);
      if (!exists) {
        // Repeated deletion is intentionally harmless.
        response.json({ documentId, deleted: true });
        return;
      }
      generation.cancelDocumentJobs(documentId);
      const deleted = database.prepare("DELETE FROM documents WHERE id = ?").run(documentId);
      if (deleted.changes === 0) throw new NotFoundError("DOCUMENT_NOT_FOUND", "The document was not found.");
      response.json({ documentId, deleted: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
