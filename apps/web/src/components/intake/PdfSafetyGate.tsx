import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { getPdfAdmissionError, hasPdfSignature } from "./pdfSafety";

type CheckState = "waiting" | "passed" | "failed" | "skipped" | "server";

interface PdfSafetyGateProps {
  onFileChange: (file: File | null) => void;
}

export function PdfSafetyGate({ onFileChange }: PdfSafetyGateProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const checkSequenceRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<CheckState>("waiting");

  async function inspectFile(candidate: File | undefined) {
    if (!candidate) return;
    const sequence = ++checkSequenceRef.current;
    setFile(null);
    onFileChange(null);
    setError(null);
    setSignature("waiting");
    setIsChecking(false);

    const admissionError = getPdfAdmissionError(candidate);
    if (admissionError) {
      setError(admissionError);
      setSignature("skipped");
      return;
    }

    setIsChecking(true);
    try {
      const bytes = new Uint8Array(await candidate.slice(0, 16).arrayBuffer());
      if (sequence !== checkSequenceRef.current) return;
      if (!hasPdfSignature(bytes)) {
        setSignature("failed");
        setError("The file does not have a valid PDF signature. Export the document as a real PDF and try again.");
        return;
      }
      setSignature("passed");
      setFile(candidate);
      onFileChange(candidate);
    } catch {
      if (sequence !== checkSequenceRef.current) return;
      setSignature("failed");
      setError("The browser could not read this file. Choose the PDF again or export a fresh copy.");
    } finally {
      if (sequence === checkSequenceRef.current) setIsChecking(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files;
    if (files && files.length > 1) {
      checkSequenceRef.current += 1;
      setFile(null);
      setIsChecking(false);
      onFileChange(null);
      setSignature("skipped");
      setError("Choose exactly one PDF file.");
      event.currentTarget.value = "";
      return;
    }
    void inspectFile(files?.[0]);
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length !== 1) {
      checkSequenceRef.current += 1;
      setFile(null);
      setIsChecking(false);
      onFileChange(null);
      setSignature("skipped");
      setError("Drop exactly one PDF file.");
      return;
    }
    void inspectFile(files[0]);
  }

  const sizeLabel = file ? `${(file.size / 1024 / 1024).toFixed(2)} MiB` : "Maximum 5 MiB";
  const fileStatus: CheckState = file ? "passed" : error ? "failed" : "waiting";
  const badge = (state: CheckState) => state === "passed" ? "PASS" : state === "failed" ? "BLOCKED" : state === "skipped" ? "SKIPPED" : state === "server" ? "NEXT" : "WAITING";

  return (
    <section className="pdf-safety-gate" aria-labelledby="pdf-safety-title" aria-live="polite">
      <div className="pdf-safety-heading">
        <div>
          <span className="eyebrow">PRE-UPLOAD SAFETY GATE</span>
          <h3 id="pdf-safety-title">Check the PDF first</h3>
          <p>Quick checks happen in your browser before the file is sent to the local API.</p>
        </div>
        <span className={`pdf-safety-seal ${file ? "is-ready" : error ? "has-error" : ""}`} aria-hidden="true">
          {isChecking ? "…" : file ? "✓" : error ? "!" : "PDF"}
        </span>
      </div>

      <div className="pdf-safety-checks" role="list" aria-label="PDF checks">
        <div className="pdf-safety-check" role="listitem"><span>PDF file and size</span><b className={`check-state state-${fileStatus.toLowerCase()}`}>{badge(fileStatus)}{file ? ` · ${sizeLabel}` : ""}</b></div>
        <div className="pdf-safety-check" role="listitem"><span>PDF content signature</span><b className={`check-state state-${signature}`}>{badge(signature)}</b></div>
        <div className="pdf-safety-check is-server-check" role="listitem"><span>Pages · readable text · language</span><b className="check-state state-server">LOCAL API CHECK</b></div>
      </div>

      <div
        className={`pdf-safety-dropzone ${file ? "has-file" : ""} ${isChecking ? "is-checking" : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input ref={inputRef} className="pdf-safety-input" type="file" accept="application/pdf,.pdf" onChange={handleFileChange} aria-label="Choose one PDF file" />
        <span className="pdf-safety-file-name">{isChecking ? "Checking PDF signature…" : file?.name ?? "No PDF selected"}</span>
        <button className="secondary-button" type="button" disabled={isChecking} onClick={() => inputRef.current?.click()}>
          {file ? "Replace PDF" : "Choose PDF"}
        </button>
        <small>Or drop one file here · max 5 MiB</small>
      </div>

      {error && <p className="pdf-safety-error" role="alert">{error}</p>}
      <p className="pdf-safety-note">The local API then checks for readable English text and at least 300 non-whitespace characters. Image-only and password-protected PDFs need a readable, unlocked export. Large documents are sampled for the lesson.</p>
    </section>
  );
}
