import assert from "node:assert/strict";
import test from "node:test";
import {
  getPdfAdmissionError,
  hasPdfSignature,
  MAX_PDF_BYTES,
} from "../src/components/intake/pdfSafety.ts";

function fileInfo(name: string, size: number): File {
  return { name, size } as File;
}

test("accepts a nonempty PDF at the 5 MiB boundary", () => {
  assert.equal(getPdfAdmissionError(fileInfo("lesson.pdf", MAX_PDF_BYTES)), null);
});

test("rejects files with a non-PDF extension", () => {
  assert.match(getPdfAdmissionError(fileInfo("lesson.docx", 1024)) ?? "", /PDF/);
});

test("rejects empty PDFs", () => {
  assert.match(getPdfAdmissionError(fileInfo("empty.pdf", 0)) ?? "", /empty/);
});

test("rejects PDFs over 5 MiB", () => {
  assert.match(getPdfAdmissionError(fileInfo("large.pdf", MAX_PDF_BYTES + 1)) ?? "", /5 MiB/);
});

test("accepts a valid PDF header", () => {
  assert.equal(hasPdfSignature(new TextEncoder().encode("%PDF-1.7\r\n%")), true);
});

test("rejects a renamed text file and a truncated header", () => {
  assert.equal(hasPdfSignature(new TextEncoder().encode("not a PDF document")), false);
  assert.equal(hasPdfSignature(new TextEncoder().encode("%PDF-1")), false);
});
