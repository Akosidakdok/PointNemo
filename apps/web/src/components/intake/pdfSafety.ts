export const MAX_PDF_BYTES = 5 * 1024 * 1024;

const PDF_SIGNATURE_PATTERN = /^%PDF-\d\.\d(?:\r|\n|\s)/;

export function getPdfAdmissionError(file: Pick<File, "name" | "size">): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return "Choose a PDF file. Other formats are not supported in this intake flow yet.";
  }
  if (file.size === 0) {
    return "This file is empty. Export a fresh PDF and try again.";
  }
  if (file.size > MAX_PDF_BYTES) {
    return "This PDF is over the 5 MiB limit. Choose a smaller file before sending it to the local API.";
  }
  return null;
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return PDF_SIGNATURE_PATTERN.test(String.fromCharCode(...bytes));
}
