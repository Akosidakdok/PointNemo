import type { IncomingMessage } from "node:http";
import { BadRequestError } from "../errors.js";
import type { UploadedDocument } from "./document-extractor.js";

const MAX_MULTIPART_BYTES = 100 * 1024 * 1024;

function extractBoundary(contentType: string | undefined): string {
  const match = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = match?.[1] ?? match?.[2];
  if (!boundary) {
    throw new BadRequestError("MULTIPART_REQUIRED", "Upload one PDF as multipart form data.");
  }
  return boundary;
}

async function readRequest(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_MULTIPART_BYTES) {
      throw new BadRequestError("FILE_TOO_LARGE", "PDF exceeds the 100 MiB size limit.");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export async function readPdfUpload(request: IncomingMessage): Promise<UploadedDocument> {
  const boundaryValue = extractBoundary(request.headers["content-type"] as string | undefined);
  const boundary = Buffer.from(`--${boundaryValue}`);
  const body = await readRequest(request);
  const firstBoundary = body.indexOf(boundary);
  if (firstBoundary !== 0) {
    throw new BadRequestError("INVALID_MULTIPART", "The upload form data is malformed.");
  }

  const headerStart = firstBoundary + boundary.length + 2;
  const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), headerStart);
  if (headerEnd < 0) {
    throw new BadRequestError("INVALID_MULTIPART", "The upload form data is missing file headers.");
  }

  const headers = body.subarray(headerStart, headerEnd).toString("utf8");
  const disposition = headers.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] ?? "";
  const name = disposition.match(/(?:^|;)\s*name="([^"]+)"/i)?.[1];
  const filename = disposition.match(/(?:^|;)\s*filename="([^"]*)"/i)?.[1];
  if (name !== "file" || !filename) {
    throw new BadRequestError("FILE_REQUIRED", "Upload one file using the form field named file.");
  }

  const contentStart = headerEnd + 4;
  const nextBoundary = body.indexOf(Buffer.from(`\r\n--${boundaryValue}`), contentStart);
  if (nextBoundary < 0) {
    throw new BadRequestError("INVALID_MULTIPART", "The upload form data has no terminating boundary.");
  }

  const contentType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() ?? "application/octet-stream";
  return {
    originalName: filename,
    mimeType: contentType,
    buffer: body.subarray(contentStart, nextBoundary),
  };
}
