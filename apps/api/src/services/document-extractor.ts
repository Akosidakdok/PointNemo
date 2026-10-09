import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";
import { PDF_LIMITS } from "@point-nemo/shared";
import { BadRequestError } from "../errors.js";

export interface UploadedDocument { originalName: string; mimeType: string; buffer: Buffer; size?: number }
export interface ExtractedDocument { sha256: string; pageCount: number; normalizedCharCount: number; pagesJson: string }
export interface DocumentExtractor { extractText(file: UploadedDocument, signal?: AbortSignal): Promise<ExtractedDocument> }
interface ParsedPage { pageNumber: number; chunkId: string; text: string; hasImages: boolean; hasDrawings: boolean }
interface WorkerResult { pages?: ParsedPage[]; error?: { code: string; message: string } }

export function admitPdf(file: UploadedDocument): void {
  if (!file.originalName.toLowerCase().endsWith(".pdf") || !["application/pdf", "application/octet-stream", ""].includes(file.mimeType)) {
    throw new BadRequestError("INVALID_FILE_TYPE", "Upload one English text-based .pdf file.");
  }
  if (!/^%PDF-\d\.\d(?:\r|\n|\s)/.test(file.buffer.subarray(0, 16).toString("ascii"))) {
    throw new BadRequestError("INVALID_PDF_SIGNATURE", "The file does not start with a valid PDF signature.");
  }
}

export function normalizePages(pages: ParsedPage[]): Omit<ExtractedDocument, "sha256"> {
  if (!pages.length) throw new BadRequestError("EMPTY_DOCUMENT", "PDF contains no pages.");
  const normalized = pages.map((page) => ({ pageNumber: page.pageNumber, chunkId: page.chunkId, text: page.text.normalize("NFC").trim().replace(/\s+/g, " ") }));
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!, text = normalized[i]!.text;
    if (page.hasImages && text.replace(/\s/g, "").length < 20) {
      throw new BadRequestError("IMAGE_DEPENDENT_PDF", `Page ${page.pageNumber} contains an image or scan without readable text. Export a text-based PDF.`);
    }
    if (text.replace(/\s/g, "").length < 20 && (page.hasDrawings || text.length > 0)) {
      throw new BadRequestError("UNUSABLE_PAGE_TEXT", `Page ${page.pageNumber} has content but too little usable text. Blank pages are allowed; scans, figures and tables are not interpreted.`);
    }
  }
  const text = normalized.map((page) => page.text).join(" ").trim();
  if (text.replace(/\s/g, "").length < PDF_LIMITS.minNonWhitespace) throw new BadRequestError("INSUFFICIENT_TEXT", "PDF needs at least 300 non-whitespace text characters.");
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length && letters.filter((letter) => /[a-z]/i.test(letter)).length / letters.length < 0.8) {
    throw new BadRequestError("UNSUPPORTED_LANGUAGE", "This release supports English text-based notes. Export an English text excerpt.");
  }
  return { pageCount: pages.length, normalizedCharCount: text.length, pagesJson: JSON.stringify(normalized) };
}

export class LocalPdfExtractor implements DocumentExtractor {
  async extractText(file: UploadedDocument, signal?: AbortSignal): Promise<ExtractedDocument> {
    admitPdf(file);
    signal?.throwIfAborted();
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    let parser: any;
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new BadRequestError("EXTRACTION_TIMEOUT", "PDF extraction exceeded 60 seconds. Export a simpler text excerpt.")), 60_000);
    });
    const extractPromise = (async () => {
      try {
        const { PDFParse } = await import("pdf-parse");
        const { OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        parser = new PDFParse({ data: new Uint8Array(file.buffer), verbosity: 0, stopAtErrors: true, isEvalSupported: false });
        // PDF.js can open encrypted PDFs with an empty user password. Permission
        // metadata alone does not mean a password is required to read the text.
        signal?.throwIfAborted();
        const data = await parser.getText({ pageJoiner: "" });
        const imageOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObjectRepeat]);
        const drawingOps = new Set([OPS.stroke, OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.shadingFill]);
        const pages: ParsedPage[] = [];
        for (const page of data.pages) {
          signal?.throwIfAborted();
          const pdfPage = await parser.doc.getPage(page.num);
          const ops = await pdfPage.getOperatorList();
          pages.push({
            pageNumber: page.num,
            chunkId: "chunk-" + page.num,
            text: page.text,
            hasImages: ops.fnArray.some((op: any) => imageOps.has(op)),
            hasDrawings: ops.fnArray.some((op: any) => drawingOps.has(op)),
          });
          pdfPage.cleanup();
        }
        return { sha256, ...normalizePages(pages) };
      } catch (error: any) {
        if (signal?.aborted) throw signal.reason;
        if (error instanceof BadRequestError) throw error;
        if (error.name === "PasswordException") {
          throw new BadRequestError("ENCRYPTED_PDF", "This PDF requires a password. Open it with its password and save an unlocked copy, then upload that copy.");
        }
        const code = typeof error.code === "string" ? error.code : "UNREADABLE_PDF";
        throw new BadRequestError(code, typeof error.code === "string" ? error.message : "The PDF is malformed or unreadable. Export a text-based PDF and try again.");
      } finally {
        try { await parser?.destroy(); } catch {}
      }
    })();

    let cancel: (() => void) | undefined;
    const cancelPromise = signal ? new Promise<never>((_, reject) => {
      cancel = () => reject(signal.reason ?? new BadRequestError("JOB_CANCELLED", "Generation was cancelled."));
      signal.addEventListener("abort", cancel, { once: true });
    }) : undefined;

    try {
      const raceTargets = [extractPromise, timeoutPromise];
      if (cancelPromise) raceTargets.push(cancelPromise);
      return await Promise.race(raceTargets);
    } finally {
      if (timer) clearTimeout(timer);
      if (cancel) signal?.removeEventListener("abort", cancel);
    }
  }
}
