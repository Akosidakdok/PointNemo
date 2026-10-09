import { PDFParse } from "pdf-parse";
import { ApiError, BadRequestError } from "../errors.js";

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_PAGES = 3;
export const MAX_NORMALIZED_CHARACTERS = 8_000;
export const MIN_NON_WHITESPACE_CHARACTERS = 300;
export const EXTRACTOR_VERSION = "pdf-parse-v2-normalized-v1";

export interface UploadedDocument {
  originalName: string;
  mimeType: string;
  buffer: Uint8Array;
}

export interface ExtractedPage {
  pageNumber: number;
  chunkId: string;
  text: string;
}

export interface ExtractedDocument {
  pageCount: number;
  normalizedChars: number;
  normalizedText: string;
  pages: ExtractedPage[];
}

function normalizePage(text: string): string {
  return text.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function validateEnglishScript(text: string): void {
  const letters = [...text.matchAll(/\p{L}/gu)].length;
  const latinLetters = [...text.matchAll(/\p{Script=Latin}/gu)].length;
  if (letters === 0 || latinLetters / letters < 0.8) {
    throw new BadRequestError("PDF_NOT_ENGLISH", "Upload an English text-based PDF. This MVP does not translate documents.");
  }
}

export class PdfDocumentExtractor {
  async extract(file: UploadedDocument, documentId: string, signal?: AbortSignal): Promise<ExtractedDocument> {
    const signature = [0x25, 0x50, 0x44, 0x46, 0x2d];
    if (!file.originalName.toLowerCase().endsWith(".pdf") || file.buffer.byteLength < signature.length
      || !file.buffer.subarray(0, signature.length).every((byte, index) => byte === signature[index])) {
      throw new BadRequestError("PDF_INVALID", "The selected file is not a readable PDF.");
    }
    if (file.buffer.byteLength >= MAX_PDF_BYTES) {
      throw new ApiError(413, "PDF_TOO_LARGE", "The PDF must be under 5 MiB.");
    }

    const parser = new PDFParse({ data: file.buffer });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const extraction = (async () => {
      const info = await parser.getInfo();
      if (!Number.isInteger(info.total) || info.total < 1) {
        throw new BadRequestError("PDF_UNREADABLE", "The PDF has no readable pages.");
      }
      if (info.total > MAX_PDF_PAGES) {
        throw new BadRequestError("PDF_TOO_MANY_PAGES", "The PDF must contain no more than 3 pages.");
      }

      const parsed = await parser.getText({ pageJoiner: "" });
      const pages: ExtractedPage[] = parsed.pages.map((page) => ({
        pageNumber: page.num,
        chunkId: `${documentId}:page:${page.num}`,
        text: normalizePage(page.text),
      }));
      const normalizedText = pages.map((page) => `Page ${page.pageNumber}: ${page.text}`).join("\n");
      const normalizedChars = pages.reduce((total, page) => total + page.text.length, 0);
      const nonWhitespaceChars = pages.reduce((total, page) => total + [...page.text].filter((char) => !/\s/u.test(char)).length, 0);

      if (normalizedChars > MAX_NORMALIZED_CHARACTERS) {
        throw new BadRequestError("PDF_TEXT_TOO_LONG", "The extracted PDF text must be no more than 8,000 normalized characters. Choose a shorter excerpt.");
      }
      if (nonWhitespaceChars < MIN_NON_WHITESPACE_CHARACTERS) {
        throw new BadRequestError("PDF_TEXT_TOO_SHORT", "The PDF must contain at least 300 readable non-whitespace characters. Scanned/image-only PDFs are not supported.");
      }
      validateEnglishScript(normalizedText);
      return { pageCount: info.total, normalizedChars, normalizedText, pages };
    })();

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new ApiError(408, "PDF_EXTRACTION_TIMEOUT", "PDF extraction exceeded the 10-second limit. Try a simpler text-based PDF.")), 10_000);
      timeout.unref?.();
      signal?.addEventListener("abort", () => reject(new ApiError(409, "JOB_CANCELLED", "The processing job was cancelled.")), { once: true });
    });

    try {
      return await Promise.race([extraction, timeoutPromise]);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const detail = error instanceof Error ? error.message : "";
      if (/password|encrypt/iu.test(detail)) {
        throw new BadRequestError("PDF_ENCRYPTED", "Password-protected PDFs are not supported. Remove the password and try again.");
      }
      throw new BadRequestError("PDF_UNREADABLE", "The PDF could not be read. Choose a valid, text-based PDF and try again.");
    } finally {
      if (timeout) clearTimeout(timeout);
      await parser.destroy().catch(() => undefined);
    }
  }
}
