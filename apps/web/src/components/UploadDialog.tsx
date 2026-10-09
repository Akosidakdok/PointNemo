import { useState, useRef, useEffect, type ChangeEvent, type DragEvent } from "react";
import { validateUploadFile } from "../api";
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
  useEffect(() => { if (!isOpen) handleReset(); }, [isOpen]);

  function validateAndSetFile(file: File) {
    setValidationError(null);

    const error = validateUploadFile(file);
    if (error) {
      setValidationError(error);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length !== 1) {
      setValidationError("Choose exactly one PDF file."); setSelectedFile(null);
    } else if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length !== 1) {
      setValidationError("Drop exactly one PDF file."); setSelectedFile(null);
    } else if (e.dataTransfer.files.length > 0) {
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
            GENERATE FRESH QUESTIONS ↗
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
              <span className="dropzone-limits">ENGLISH TEXT PDF · MAX 3 PAGES · MAX 5 MiB</span>
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
            <li><span>✓</span> Exactly 1 text-based PDF file</li>
            <li><span>✓</span> English text-based PDF, at most 3 pages</li>
            <li><span>✓</span> At most 5 MiB and 8,000 normalized characters</li>
            <li><span>✓</span> At least 300 non-whitespace characters</li>
            <li><span>✗</span> Scanned/image-only PDFs rejected (No OCR)</li>
            <li><span>✗</span> Encrypted or password-protected PDFs rejected</li>
          </ul>
          <p>The local server checks signature, extracted text, language, pages, and model input budget. Figures and image-dependent content are not interpreted.</p>
          <p>Uploading always requests fresh generation. Choose saved questions separately from the library.</p>
        </div>
      </div>
    </GameModal>
  );
}
