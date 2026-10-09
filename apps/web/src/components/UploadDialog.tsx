import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { GameModal } from "./ui/GameModal";
import { GameButton } from "./ui/GameButton";

export interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmFile: (file: File) => void;
}

export function UploadDialog({ isOpen, onClose, onConfirmFile }: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function validateAndSetFile(file: File) {
    setValidationError(null);

    // 1. Check extension and mime type
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".pdf") && file.type !== "application/pdf") {
      setValidationError("Only PDF files are supported in this MVP.");
      setSelectedFile(null);
      return;
    }

    if (file.size >= 5 * 1024 * 1024) {
      setValidationError("PDF must be smaller than 5 MiB.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleReset() {
    setSelectedFile(null);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!isOpen) return null;

  return (
    <GameModal
      isOpen={isOpen}
      onClose={onClose}
      title="UPLOAD STUDY DOCUMENT"
      subtitle="PDF ADMISSION TELEMETRY"
      maxWidth="560px"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <GameButton variant="secondary" size="md" onClick={onClose}>
            CANCEL
          </GameButton>
          <GameButton
            variant="primary"
            size="md"
            disabled={!selectedFile}
            onClick={() => {
              if (selectedFile) {
                onConfirmFile(selectedFile);
                handleReset();
              }
            }}
          >
            CONTINUE TO SONAR ↗
          </GameButton>
        </div>
      }
    >
      <div className="upload-dialog-content">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {/* Drop Zone */}
        <div
          className={`upload-dropzone ${isDragging ? "is-drag-over" : ""} ${selectedFile ? "has-file" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Click or drag and drop a PDF file"
        >
          <span className="dropzone-icon" aria-hidden="true">⌖</span>

          {!selectedFile ? (
            <>
              <p className="dropzone-prompt">
                <b>CLICK TO BROWSE</b> OR DRAG ONE PDF HERE
              </p>
              <span className="dropzone-limits">ENGLISH TEXT · UNDER 5 MiB · UP TO 3 PAGES</span>
            </>
          ) : (
            <div className="selected-file-meta">
              <span className="file-tag">PDF SELECTED</span>
              <p className="file-name">{selectedFile.name}</p>
              <span className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="upload-error-banner" role="alert">
            <span className="error-icon" aria-hidden="true">⚠</span>
            <div className="error-text">
              <b>ADMISSION REJECTED:</b> {validationError}
            </div>
          </div>
        )}

        {/* Admission checklist */}
        <div className="admission-rules-checklist">
          <span className="checklist-heading">PDF ADMISSION RULES:</span>
          <ul>
            <li><span>✓</span> One English, text-based PDF</li>
            <li><span>✓</span> Smaller than 5 MiB · up to 3 pages</li>
            <li><span>✓</span> 300–8,000 extractable characters</li>
            <li><span>✗</span> Scanned/image-only PDFs are unsupported (no OCR)</li>
            <li><span>✗</span> Encrypted or password-protected PDFs are unsupported</li>
          </ul>
          <p className="admission-rules-note">Page count and readable text are checked locally after you continue. English is expected; language is not auto-detected yet.</p>
        </div>
      </div>
    </GameModal>
  );
}
