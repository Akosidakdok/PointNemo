import { useEffect, useState } from "react";
import { type GenerationJob } from "../api";
import { type ProcessingStage } from "../processing";
import { GameButton } from "./ui/GameButton";

export interface SonarProcessingProps {
  filename: string;
  stage: ProcessingStage;
  job: GenerationJob | null;
  error: string | null;
  isCancelling: boolean;
  canRetry: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onReturnToLibrary: () => void;
  onChooseAnotherPdf: () => void;
}

export function SonarProcessing({ filename, stage, job, error, isCancelling, canRetry,
  onCancel, onRetry, onReturnToLibrary, onChooseAnotherPdf }: SonarProcessingProps) {
  const [startedAt, setStartedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { if (stage === "uploading" && !job) setStartedAt(Date.now()); }, [stage, job]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const terminal = !!job && ["ready", "failed", "cancelled"].includes(job.state);
  const elapsedMs = terminal ? job.elapsedTimeMs ?? 0
    : job ? Math.max(job.elapsedTimeMs ?? 0, now - Date.parse(job.createdAt)) : now - startedAt;
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const stages = ["extracting", "generating", "validating"] as const;
  const activeIndex = stages.findIndex((entry) => entry === (job?.state === "failed" ? job.errorStage : job?.state));
  const failure = error || (job?.state === "failed" ? job.errorMessage || "The local generation job failed." : null);
  return (
    <div className="sonar-processing-view" role="region" aria-label="Document processing">
      <div className="sonar-processing-card pixel-panel">
        <header className="sonar-header"><div>
          <h1 className="sonar-title">POINT NEMO — SOURCE PROCESSING</h1>
          <p className="sonar-filename">DOCUMENT: <b>{filename}</b></p>
          <p role="status">{isCancelling ? "Cancellation requested. Waiting for the server to confirm…" : stage === "uploading" ? "Uploading and checking admission…" : stage === "opening" ? "Questions saved. Opening an authoritative run…" : job?.state === "cancelled" ? "Generation cancelled by the server." : "Reading the actual local job status."}</p>
        </div></header>
        <div className="sonar-stages-list">{stages.map((entry, index) => {
          const status = job?.state === "ready" ? "complete" : job?.state === "cancelled" ? "stopped"
            : activeIndex < 0 ? "waiting" : index < activeIndex ? "complete"
            : index === activeIndex ? job?.state === "failed" ? "failed" : "active" : "waiting";
          return <div key={entry} className={`sonar-stage stage-${status}`}>
            <div className="stage-indicator"><span aria-hidden="true">{status === "complete" ? "✓" : status === "failed" ? "✕" : status === "active" ? "●" : "○"}</span></div>
            <div className="stage-content"><div className="stage-name-row"><span className="stage-title">{index + 1}. {entry.toUpperCase()}</span><span className="stage-status-badge">{status.toUpperCase()}</span></div></div>
          </div>;
        })}</div>
        <div className="sonar-telemetry-row"><span>{job ? "JOB ELAPSED" : "UPLOAD ELAPSED"}: <b>{elapsed}</b></span><span>REQUESTED: <b>3 TOPICS · 9 QUESTIONS</b></span></div>
        {job?.retryCount !== undefined && <p>Model repair attempts: {job.retryCount} / 1</p>}
        {job?.timings && Object.keys(job.timings).length > 0 && <p>Recorded timings: {Object.entries(job.timings).map(([name, duration]) => `${name}: ${(duration / 1000).toFixed(1)}s`).join(" · ")}</p>}
        {failure && <div className="sonar-failure-panel" role="alert">
          <h2 className="failure-heading">{job?.state === "failed" ? `GENERATION FAILED${job.errorStage ? ` DURING ${job.errorStage.toUpperCase()}` : ""}` : "LOCAL REQUEST COULD NOT BE COMPLETED"}</h2>
          <p className="failure-message">{failure}{job?.errorCode ? ` (${job.errorCode})` : ""}</p>
          <p>Saved lessons remain available in the library. Using them is a separate choice.</p>
          <div className="failure-actions">
            {canRetry && <GameButton variant="primary" disabled={isCancelling} onClick={onRetry}>RETRY · FRESH GENERATION</GameButton>}
            <GameButton disabled={isCancelling} onClick={onChooseAnotherPdf}>CHOOSE ANOTHER PDF</GameButton>
            <GameButton disabled={isCancelling} onClick={onReturnToLibrary}>RETURN TO LIBRARY</GameButton>
          </div>
        </div>}
        <div className="sonar-footer-actions"><GameButton disabled={isCancelling} onClick={onCancel}>{isCancelling ? "CONFIRMING CANCELLATION…" : terminal ? "RETURN TO LIBRARY" : "CANCEL GENERATION"}</GameButton></div>
      </div>
    </div>
  );
}
