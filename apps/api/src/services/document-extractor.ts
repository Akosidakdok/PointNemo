import { ServiceUnavailableError } from "../errors.js";

export interface UploadedDocument {
  originalName: string;
  mimeType: string;
  buffer: Uint8Array;
}

export interface DocumentExtractor {
  extractText(file: UploadedDocument): Promise<string>;
}

export class UnconfiguredDocumentExtractor implements DocumentExtractor {
  async extractText(_file: UploadedDocument): Promise<string> {
    throw new ServiceUnavailableError(
      "DOCUMENT_PARSER_UNAVAILABLE",
      "Document parsing is not configured yet. Add PDF, DOCX, or PPTX extraction support before processing uploads.",
    );
  }
}
