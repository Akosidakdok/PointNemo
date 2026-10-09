import { useState, useRef, useCallback } from "react";
import { type QuestionSet } from "@point-nemo/shared";

interface DocumentIntakeModuleProps {
  onStartRealProcessing?: (file: File) => Promise<QuestionSet | void>;
  onProcessingFinished: (qSet?: QuestionSet) => void;
  onCancel: () => void;
  realExtractionStatus?: "waiting" | "active" | "complete" | "failed";
  realGenerationStatus?: "waiting" | "active" | "complete" | "failed";
  realValidationStatus?: "waiting" | "active" | "complete" | "failed";
  realError?: string | null;
  isOllamaOffline?: boolean;
}

const STAGES = [
  {
    title: "Extracting text",
    desc: "Reading page text and source locations on this device locally.",
  },
  {
    title: "Generating questions",
    desc: "Local Ollama drafts 3 source-grounded questions across 3 oceanic topics.",
  },
  {
    title: "Validating sources",
    desc: "Checking exact question count, defensible answer keys, and supporting PDF quotes.",
  },
];

export function DocumentIntakeModule({
  onStartRealProcessing,
  onProcessingFinished,
  onCancel,
  realExtractionStatus,
  realGenerationStatus,
  realValidationStatus,
  realError,
  isOllamaOffline,
}: DocumentIntakeModuleProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [simulatedStage, setSimulatedStage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setFileError("Please choose a valid PDF file. Point Nemo requires an English text-based PDF.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileError(null);

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setFileError("Please choose a valid PDF file.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleBeginCalibration = useCallback(async () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    if (onStartRealProcessing) {
      try {
        const result = await onStartRealProcessing(selectedFile);
        if (result) {
          onProcessingFinished(result);
        }
      } catch (err: any) {
        console.warn("Real processing returned error or handled via props:", err);
      }
    }
  }, [selectedFile, onStartRealProcessing, onProcessingFinished]);

  const handleAdvanceSimulatedStage = () => {
    if (simulatedStage >= STAGES.length - 1) {
      onProcessingFinished();
      return;
    }
    setSimulatedStage((prev) => prev + 1);
  };

  // Determine stage display: prefer real statuses if active, else simulated
  const isReal = Boolean(onStartRealProcessing && realExtractionStatus);
  const activeStageIndex = isReal
    ? realValidationStatus === "active" || realValidationStatus === "complete"
      ? 2
      : realGenerationStatus === "active" || realGenerationStatus === "complete"
      ? 1
      : 0
    : simulatedStage;

  return (
    <section className="document-intake-module" aria-labelledby="intake-title">
      {!isProcessing ? (
        <div className="intake-selection-view">
          <div className="eyebrow">MODULE 01 · DOCUMENT INTAKE</div>
          <div className="page-heading">
            <div>
              <h1 id="intake-title">Add a study PDF</h1>
              <p>Upload an English text-based PDF to generate your local 9-question ocean descent.</p>
            </div>
            <p className="model-info">
              Inference model: <b>qwen2.5:1.5b (Local Ollama)</b>
            </p>
          </div>

          <div className="panel upload-panel" style={{ maxWidth: "680px", margin: "0 auto" }}>
            <div className="panel-heading">
              <div>
                <h2>Document selection</h2>
                <p>No upper page or file-size limit · Min 300 characters extracted locally</p>
              </div>
            </div>

            <label
              className="dropzone"
              htmlFor="pdf-file-upload"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <span className="upload-icon" aria-hidden="true">
                ↑
              </span>
              <strong>{selectedFile ? selectedFile.name : "Choose a PDF file or drag it here"}</strong>
              <span>
                {selectedFile
                  ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MiB · Ready for sonar extraction`
                  : "English, text-based documents only. Encrypted or image-only PDFs are rejected."}
              </span>
              <span className="choose-button">
                {selectedFile ? "Replace file" : "Browse files"}
              </span>
            </label>

            <input
              id="pdf-file-upload"
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            {fileError && (
              <p className="file-status error-text" role="alert">
                ⚠ {fileError}
              </p>
            )}

            {selectedFile && !fileError && (
              <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="secondary-button" onClick={onCancel}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleBeginCalibration}
                >
                  Start Sonar Processing <span>→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="intake-sonar-view">
          <div className="eyebrow">MODULE 02 · LOCAL PROCESSING</div>
          <div className="page-heading">
            <div>
              <h1 id="sonar-title">Preparing your descent</h1>
              <p>Source grounding and local AI processing running offline on your hardware.</p>
            </div>
            <p className="model-info">
              Local Ollama: <b>qwen2.5:1.5b</b>
            </p>
          </div>

          <section className="panel sonar-panel">
            <div className="sonar-rings" aria-hidden="true">
              <i />
              <i />
              <i />
              <b>◉</b>
            </div>

            <p className="eyebrow center-eyebrow">
              SONAR CALIBRATION <span>{`0${activeStageIndex + 1} / 03`}</span>
            </p>

            <h2 id="sonar-state">{STAGES[activeStageIndex].title}</h2>
            <p className="muted center" style={{ maxWidth: "440px", margin: "6px auto 0" }}>
              {STAGES[activeStageIndex].desc}
            </p>

            <ol className="stage-list" id="stage-list">
              {STAGES.map((stg, idx) => {
                const isCurrent = idx === activeStageIndex;
                const isDone = idx < activeStageIndex;
                return (
                  <li key={stg.title} className={isCurrent ? "current" : isDone ? "done" : ""}>
                    <span>{`0${idx + 1}`}</span> {stg.title.split(" ")[0]}
                  </li>
                );
              })}
            </ol>

            {realError && (
              <div
                style={{
                  color: "var(--danger)",
                  margin: "12px 0 18px",
                  padding: "10px",
                  border: "1px solid var(--danger)",
                  borderRadius: "8px",
                  background: "rgba(255, 72, 83, 0.1)",
                  fontSize: "12px",
                }}
                role="alert"
              >
                <b>CALIBRATION INTERRUPTED:</b> {realError}
                {isOllamaOffline && (
                  <p style={{ margin: "6px 0 0", fontSize: "11px", color: "var(--text)" }}>
                    Ensure local Ollama service is active (`ollama serve`) with model `qwen2.5:1.5b`.
                  </p>
                )}
              </div>
            )}

            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setIsProcessing(false);
                  onCancel();
                }}
              >
                Cancel
              </button>

              {!isReal && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleAdvanceSimulatedStage}
                >
                  {simulatedStage === STAGES.length - 1 ? "Choose your sea →" : "Advance preview state →"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
