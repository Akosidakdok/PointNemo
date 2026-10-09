import { createHash } from "node:crypto";
// @ts-expect-error TS1192: pdf-parse has no default export in its types but works at runtime
import pdfParse from "pdf-parse";
import { BadRequestError } from "../errors.js";

export interface UploadedDocument {
  originalName: string;
  mimeType: string;
  buffer: Uint8Array;
}

export interface ExtractedDocument {
  sha256: string;
  pageCount: number;
  normalizedCharCount: number;
  pagesJson: string; // Serialized array of pages/chunks
}

export interface DocumentExtractor {
  extractText(file: UploadedDocument): Promise<ExtractedDocument>;
}

export class LocalPdfExtractor implements DocumentExtractor {
  async extractText(file: UploadedDocument): Promise<ExtractedDocument> {
    // 1. Verify MIME type
    if (file.mimeType !== "application/pdf") {
      throw new BadRequestError("INVALID_FILE_TYPE", "Only PDF files are supported.");
    }

    // 2. Check File Size (5 MiB = 5242880 bytes)
    if (file.buffer.length > 5242880) {
      throw new BadRequestError("FILE_TOO_LARGE", "PDF exceeds the 5 MiB size limit.");
    }

    // 3. Compute SHA-256
    const hash = createHash("sha256").update(file.buffer).digest("hex");

    let data;
    try {
      // 4. Parse PDF
      data = await pdfParse(Buffer.from(file.buffer));
    } catch (error) {
      throw new BadRequestError(
        "UNREADABLE_PDF",
        "The PDF could not be parsed. It may be encrypted, malformed, or unsupported.",
      );
    }

    // 5. Enforce Limits
    if (data.numpages > 3) {
      throw new BadRequestError("TOO_MANY_PAGES", "PDF exceeds the 3-page limit.");
    }

    // Basic normalization: trim and compress whitespace
    const normalizedText = data.text.trim().replace(/\s+/g, " ");
    const charCount = normalizedText.length;

    if (charCount < 300) {
      throw new BadRequestError(
        "INSUFFICIENT_TEXT",
        "PDF must contain at least 300 characters of extractable text.",
      );
    }
    if (charCount > 8000) {
      throw new BadRequestError(
        "CONTEXT_OVERFLOW",
        "PDF exceeds the 8,000 character limit.",
      );
    }

    // 6. Return Structured Output
    // For P0, we map the entire document to a single chunk on page 1
    // to simplify evidence mapping since pdf-parse doesn't strictly provide
    // per-page bounding boxes by default without a custom page renderer.
    return {
      sha256: hash,
      pageCount: data.numpages,
      normalizedCharCount: charCount,
      pagesJson: JSON.stringify([{ pageNumber: 1, chunkId: "chunk-1", text: normalizedText }]),
    };
  }
}
