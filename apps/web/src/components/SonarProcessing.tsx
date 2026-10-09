import { useEffect, useState } from "react";
import { GameButton } from "./ui/GameButton";

export type SonarStageStatus = "waiting" | "active" | "complete" | "failed";

export interface SonarProcessingProps {
  filename: string;
  extractionStatus: SonarStageStatus;
  generationStatus: SonarStageStatus;
  validationStatus: SonarStageStatus;
  extractionDetail?: string;
  generationDetail?: string;
  validationDetail?: string;
  error?: string | null;
  isOllamaOffline?: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onChooseAnotherPdf: () => void;
}

export function SonarProcessing({
  filename,
  extractionStatus,
  generationStatus,
  validationStatus,
  extractionDetail = "Reading source and locating pages",
  generationDetail = "Preparing questions with local AI",
  validationDetail = "Checking answers and source evidence",
  error = null,
  isOllamaOffline = false,
  onCancel,
  onRetry,
  onChooseAnotherPdf,
}: SonarProcessingProps) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const hasFailed =
    extractionStatus === "failed" ||
    generationStatus === "failed" ||
    validationStatus === "failed" ||
    error !== null;

  useEffect(() => {
    if (hasFailed) return;
    const interval = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [hasFailed]);

  const formattedTime = `${String(Math.floor(secondsElapsed / 60)).padStart(2, "0")}:${String(
    secondsElapsed % 60
  ).padStart(2, "0")}`;

  function renderStatusIcon(status: SonarStageStatus) {
    if (status === "complete") return <span className="status-icon icon-complete">✓</span>;
    if (status === "active") return <span className="status-icon icon-active">●</span>;
    if (status === "failed") return <span className="status-icon icon-failed">✕</span>;
    return <span className="status-icon icon-waiting">○</span>;
  }

  return (
    <div className="sonar-processing-view" role="region" aria-label="Sonar document processing">
      <div className="sonar-processing-card pixel-panel">
        <header className="sonar-header">
          <div className="sonar-radar-orb" aria-hidden="true">
            <span className="radar-beam" />
            <span className="radar-blip" />
          </div>
          <div>
            <p className="sonar-eyebrow">HADAL ACOUSTIC SCAN // SOURCE PROCESSING</p>
            <h1 className="sonar-title">POINT NEMO — SONAR PROCESSING</h1>
            <p className="sonar-filename">SOURCE DOCUMENT: <b>{filename}</b></p>
          </div>
        </header>

        {/* 3 Real Stages */}
        <div className="sonar-stages-list">
          {/* Stage 1: Extraction */}
          <div className={`sonar-stage stage-${extractionStatus}`}>
            <div className="stage-indicator">
              {renderStatusIcon(extractionStatus)}
            </div>
            <div className="stage-content">
              <div className="stage-name-row">
                <span className="stage-title">1. EXTRACTION</span>
                <span className="stage-status-badge">{extractionStatus.toUpperCase()}</span>
              </div>
              <p className="stage-description">{extractionDetail}</p>
            </div>
          </div>

          {/* Stage 2: Generation */}
          <div className={`sonar-stage stage-${generationStatus}`}>
            <div className="stage-indicator">
              {renderStatusIcon(generationStatus)}
            </div>
            <div className="stage-content">
              <div className="stage-name-row">
                <span className="stage-title">2. GENERATION</span>
                <span className="stage-status-badge">{generationStatus.toUpperCase()}</span>
              </div>
              <p className="stage-description">{generationDetail}</p>
            </div>
          </div>

          {/* Stage 3: Validation */}
          <div className={`sonar-stage stage-${validationStatus}`}>
            <div className="stage-indicator">
              {renderStatusIcon(validationStatus)}
            </div>
            <div className="stage-content">
              <div className="stage-name-row">
                <span className="stage-title">3. VALIDATION</span>
                <span className="stage-status-badge">{validationStatus.toUpperCase()}</span>
              </div>
              <p className="stage-description">{validationDetail}</p>
            </div>
          </div>
        </div>

        {/* Timer row */}
        <div className="sonar-telemetry-row">
          <span>ELAPSED TIME: <b>{formattedTime}</b></span>
          <span>TARGET: <b>EXACTLY 9 SOURCE-GROUNDED QUESTIONS</b></span>
        </div>

        {/* Error / Failure Banner */}
        {hasFailed && (
          <div className="sonar-failure-panel" role="alert">
            <h2 className="failure-heading">
              {isOllamaOffline ? "LOCAL AI UNAVAILABLE" : "SONAR PROCESSING HALTED"}
            </h2>
            <p className="failure-message">
              {isOllamaOffline
                ? "Point Nemo could not connect to the configured local Ollama service. Ensure Ollama is running (ollama serve) with model qwen2.5:1.5b pulled."
                : error || "Point Nemo could not complete source calibration from this document."}
            </p>
            <div className="failure-actions">
              <GameButton variant="primary" size="md" onClick={onRetry}>
                ↻ RETRY CALIBRATION
              </GameButton>
              <GameButton variant="secondary" size="md" onClick={onChooseAnotherPdf}>
                CHOOSE ANOTHER PDF
              </GameButton>
              <GameButton variant="secondary" size="md" onClick={onCancel}>
                RETURN TO LIBRARY
              </GameButton>
            </div>
          </div>
        )}

        {/* Non-failed Cancel row */}
        {!hasFailed && (
          <div className="sonar-footer-actions">
            <GameButton variant="secondary" size="md" onClick={onCancel}>
              [CANCEL] RETURN TO LIBRARY
            </GameButton>
          </div>
        )}
      </div>
    </div>
  );
}
