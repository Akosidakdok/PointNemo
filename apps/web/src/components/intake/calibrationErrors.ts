export interface CalibrationErrorHelp {
  message: string;
  retry: boolean;
  retryLabel?: string;
  alternateLabel?: string;
}

export function calibrationErrorHelp(code: string | undefined, detail = ""): CalibrationErrorHelp {
  const fileErrors: Record<string,string> = {
    INVALID_FILE_TYPE: "Choose one PDF file. Other document formats are not supported.",
    INVALID_PDF_SIGNATURE: "This file is not a readable PDF. Export a fresh PDF and choose it again.",
    UNREADABLE_PDF: "This PDF could not be opened. Export a fresh text-based copy.",
    ENCRYPTED_PDF: "This PDF needs a password. Open it with the password and save an unlocked copy.",
    EMPTY_DOCUMENT: "The PDF has no pages. Choose a PDF containing your study notes.",
    IMAGE_DEPENDENT_PDF: "A page contains a scan without readable text. Use OCR or export a text-based PDF.",
    UNUSABLE_PAGE_TEXT: "A page has too little readable text. Export the text of your notes; figures and tables are not interpreted.",
    INSUFFICIENT_TEXT: "The PDF needs at least 300 non-whitespace text characters. Choose a more detailed section.",
    UNSUPPORTED_LANGUAGE: "Choose an English text-based PDF for this version.",
    EXTRACTION_TIMEOUT: "Reading the PDF took too long. Export a simpler text-based excerpt.",
    INSUFFICIENT_SOURCE: "The selected text does not support nine distinct questions. Choose a more detailed section.",
    TOKEN_OVERFLOW: "The question and source exceed the local model’s context budget. Choose a shorter excerpt.",
    REUPLOAD_REQUIRED: "Choose the PDF again so its text can be read with the current version.",
    FILE_TOO_LARGE: "Choose one PDF smaller than 5 MiB.",
  };
  if (code && fileErrors[code]) return {message:fileErrors[code]!,retry:false};
  const serviceErrors: Record<string,string> = {
    INTERRUPTED_JOB: "Processing stopped before the quiz was finished. Retry using your saved PDF text.",
    OLLAMA_UNAVAILABLE: "The local question service is unavailable. Start Ollama, then retry.",
    OLLAMA_REQUEST_FAILED: "The local model rejected the request. Check that the configured model is installed, then retry.",
    INFERENCE_TIMEOUT: "The local model took too long. Close other demanding apps, then retry or choose a shorter excerpt.",
    JOB_TIMEOUT: "Creating and repairing the quiz took too long. Retry or choose a shorter excerpt.",
    GENERATION_BUSY: "Another PDF is being processed. Wait for it to finish or cancel it before trying again.",
    ORIGIN_NOT_ALLOWED: "Open Point Nemo at its local address (127.0.0.1) to upload your PDF.",
    NETWORK_ERROR: "The local API could not be reached. Start the Point Nemo services, then retry.",
    JOB_CANCELLED: "Quiz creation was cancelled. Choose your PDF again when you’re ready.",
  };
  if (code && serviceErrors[code]) return {message:serviceErrors[code]!,retry:code !== "JOB_CANCELLED"};
  const lower = detail.toLowerCase();
  const slot = detail.match(/question (\d+)/i)?.[1];
  const prefix = slot ? `Question ${slot}: ` : "";
  if (code === "SOURCE_EVIDENCE_INVALID" || lower.includes("short exact phrase")) {
    return {message:`${prefix}The model could not support an answer with your PDF text after repair. Retry with a fresh draft or choose a clearer excerpt.`,retry:true};
  }
  if (code === "DUPLICATE_QUESTION" || lower.includes("repeats question")) {
    return {message:`${prefix}The model still repeated a fact after repair. Retry with a fresh draft or choose a more detailed section.`,retry:true};
  }
  if (/\banswer[_\s-]?choices?\b/.test(lower) || lower.includes("distinct answer choices") || lower.includes("answer options") || lower.includes("distractor")) {
    return {
      message:`${prefix}The model could not make four clearly different answer choices after repair. Generate a fresh draft from the saved PDF text; if it happens again, upload a shorter excerpt focused on another section.`,
      retry:true,
      retryLabel:"Generate a fresh draft →",
      alternateLabel:"Choose a clearer excerpt PDF",
    };
  }
  if (code === "OLLAMA_INVALID_JSON" || code === "INVALID_MODEL_OUTPUT") {
    return {message:`${prefix}The local model returned an incomplete or malformed question after repair. Retry with a fresh draft.`,retry:true};
  }
  return {message:"Quiz creation could not finish. Retry or choose another PDF.",retry:true};
}
