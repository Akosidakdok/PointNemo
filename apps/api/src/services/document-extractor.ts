import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { BadRequestError } from "../errors.js";

export interface UploadedDocument {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  size?: number;
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

    let data: Awaited<ReturnType<PDFParse["getText"]>>;
    let parser: PDFParse | undefined;
    try {
      // 4. Parse PDF
      parser = new PDFParse({ data: Buffer.from(file.buffer) });
      data = await parser.getText();
    } catch (error) {
      throw new BadRequestError(
        "UNREADABLE_PDF",
        "The PDF could not be parsed. It may be encrypted, malformed, or unsupported.",
      );
    } finally {
      await parser?.destroy();
    }

    // 5. Enforce Limits
    if (data.total > 3) {
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
    return {
      sha256: hash,
      pageCount: data.total,
      normalizedCharCount: charCount,
      pagesJson: JSON.stringify(
        data.pages.map((page) => ({
          pageNumber: page.num,
          chunkId: `chunk-${page.num}`,
          text: page.text.trim().replace(/\s+/g, " "),
        })),
      ),
    };
  }
}
