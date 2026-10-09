import { useEffect, useState } from "react";
import {
  getGenerationJob,
  getQuestionSet,
  uploadDocument,
  type GenerationJob,
  type JobState,
  type QuestionSet,
} from "../api";

const stageLabels: Record<JobState, string> = {
  extracting: "READING PDF",
  generating: "BUILDING QUESTIONS",
  validating: "CHECKING EVIDENCE",
  ready: "READY TO DESCEND",
  failed: "GENERATION FAILED",
  cancelled: "CANCELLED",
};

interface DocumentIntakeProps {
  onStartRun?: (questionSetId: string) => void;
  activeRunId?: string;
}

function DocumentIntake({ onStartRun, activeRunId }: DocumentIntakeProps = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string>();
  const [job, setJob] = useState<GenerationJob>();
  const [questionSet, setQuestionSet] = useState<QuestionSet>();
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let attempts = 0;
    const poll = async () => {
      try {
        const nextJob = await getGenerationJob(jobId);
        if (!active) return;
        setJob(nextJob);
        if (nextJob.state === "ready" && nextJob.questionSetId) {
          const nextQuestionSet = await getQuestionSet(nextJob.questionSetId);
          if (active) setQuestionSet(nextQuestionSet);
          return;
        }
        if (nextJob.state === "failed" || nextJob.state === "cancelled") {
          setError(nextJob.errorCode ?? "The local generation job did not complete.");
          return;
        }
        attempts += 1;
        if (attempts >= 60) {
          setError("Generation is taking longer than the 90-second demo window.");
          return;
        }
        window.setTimeout(() => void poll(), 1_500);
      } catch (pollError) {
        if (active) setError(pollError instanceof Error ? pollError.message : "Could not read generation status.");
      }
    };
    void poll();
    return () => { active = false; };
  }, [jobId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    if (file.size >= 5 * 1024 * 1024) {
      setError("PDF must be smaller than 5 MiB.");
      return;
    }
    setUploading(true);
    setError(undefined);
    setJob(undefined);
    setQuestionSet(undefined);
    try {
      const result = await uploadDocument(file);
      setJobId(result.jobId);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The document could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="intake-card" aria-live="polite">
      <div className="intake-heading">
        <div><p className="eyebrow">LOCAL DOCUMENT INTAKE</p><h2>Bring a lesson<br /><em>below the surface.</em></h2></div>
        <span className="intake-mark" aria-hidden="true">↓</span>
      </div>
      <p className="intake-copy">Upload a PDF and the local model will turn its source text into nine evidence-linked questions.</p>
      <form onSubmit={handleSubmit}>
        <label className="file-picker">
          <span>{file?.name ?? "Choose a PDF · under 5 MiB · up to 3 pages"}</span>
          <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <button className="intake-button" type="submit" disabled={!file || uploading || Boolean(job && !["ready", "failed", "cancelled"].includes(job.state))}>
          {uploading ? "Uploading…" : "Start descent"}<span aria-hidden="true">↘</span>
        </button>
      </form>
      {job && <div className={`intake-status intake-${job.state}`}><span className="intake-status-dot" /><b>{stageLabels[job.state]}</b><span>{job.state === "ready" ? "3 topics · 9 questions" : job.errorCode ?? "Local worker active"}</span></div>}
      {questionSet && (
        <div className="question-set-preview">
          <span className="eyebrow">QUESTION SET LOADED</span>
          <div>{questionSet.topics.join(" · ")}</div>
          <small>18 fixed encounter slots ready in the expedition route.</small>
          {onStartRun && (
            <button
              className="intake-button"
              type="button"
              style={{ marginTop: 9 }}
              onClick={() => onStartRun(questionSet.id)}
            >
              <span>{activeRunId ? "Resume expedition run" : "Begin descent run"}</span>
              <span aria-hidden="true">↘</span>
            </button>
          )}
        </div>
      )}
      {error && <p className="intake-error">{error}</p>}
    </section>
  );
}

export { DocumentIntake };
