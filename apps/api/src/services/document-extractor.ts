import { PDFParse } from "pdf-parse";
import { type ExtractedDocument, type ExtractedPage } from "@point-nemo/shared";
import { ValidationError } from "../errors.js";

export interface UploadedDocument {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
}

export interface DocumentExtractor {
  extractText(file: UploadedDocument): Promise<ExtractedDocument>;
}

export class LocalPdfExtractor implements DocumentExtractor {
  async extractText(file: UploadedDocument): Promise<ExtractedDocument> {
    // 1. File type validation
    const lowerName = file.originalName.toLowerCase();
    if (!lowerName.endsWith(".pdf") && file.mimeType !== "application/pdf") {
      throw new ValidationError("Only PDF files are supported in this MVP.");
    }

    // 2. Parse PDF with PDFParse
    let parsed: { total: number; pages: Array<{ text: string; num: number }>; text: string };
    try {
      const parser = new PDFParse({ data: file.buffer });
      parsed = await parser.getText();
      await parser.destroy();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("password") || msg.includes("Password") || msg.includes("encrypt")) {
        throw new ValidationError("This PDF is encrypted or password-protected.");
      }
      throw new ValidationError("Point Nemo could not extract readable text from this PDF.");
    }

    // 3. Ensure pages exist
    if (parsed.total === 0 || !parsed.pages || parsed.pages.length === 0) {
      throw new ValidationError("Point Nemo could not locate any pages in this PDF.");
    }

    // 4. Build page records & normalize text
    const pages: ExtractedPage[] = [];
    let combinedNormalized = "";

    for (const p of parsed.pages) {
      // Normalize whitespace
      const normalizedPageText = p.text
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .trim();

      pages.push({
        pageNumber: p.num,
        text: normalizedPageText,
      });

      if (combinedNormalized.length > 0) {
        combinedNormalized += "\n\n";
      }
      combinedNormalized += `[Page ${p.num}]\n${normalizedPageText}`;
    }

    // 5. Minimum character validation (at least 300 non-whitespace characters)
    const nonWhitespaceCount = combinedNormalized.replace(/\s+/g, "").length;
    if (nonWhitespaceCount < 300) {
      throw new ValidationError(
        "This appears to be a scanned or image-only PDF. OCR is not supported in this MVP."
      );
    }

    // 8. Basic English detection (ensure standard Latin alphabet predominance)
    const latinAlphaMatches = combinedNormalized.match(/[a-zA-Z]/g) || [];
    if (latinAlphaMatches.length < nonWhitespaceCount * 0.5) {
      throw new ValidationError(
        "This document does not appear to contain English text. English is required for this MVP."
      );
    }

    return {
      filename: file.originalName,
      fileSize: file.size,
      pageCount: parsed.total,
      totalCharacters: combinedNormalized.length,
      pages,
      normalizedText: combinedNormalized,
    };
  }
}
