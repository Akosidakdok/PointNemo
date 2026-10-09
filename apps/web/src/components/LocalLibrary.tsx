import { useState } from "react";
import { toDescentRun, type LibraryDocument, type AppStatus } from "../api";
import { GameButton } from "./ui/GameButton";
import { ConfirmDialog } from "./ConfirmDialog";

export interface LocalLibraryProps {
  documents: LibraryDocument[];
  error: string | null;
  busy: string | null;
  onRefresh: () => void;
  onUploadClick: () => void;
  onResumeRun: (runId: string) => void;
  onTryAgain: (runId: string) => void;
  onViewResults: (runId: string) => void;
  onUseSaved: (questionSetId: string) => void;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onCancelJob: (jobId: string) => void;
  status: AppStatus;
  onOpenSettings: () => void;
  currentUser: { displayName: string };
  onChangeName: () => void;
}

export function LocalLibrary({ documents, error, busy, onRefresh, onUploadClick,
  onResumeRun, onTryAgain, onViewResults, onUseSaved, onDeleteDocument, onCancelJob,
  status, onOpenSettings, currentUser, onChangeName }: LocalLibraryProps) {
  const [deleteTarget, setDeleteTarget] = useState<LibraryDocument | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const activeRuns = documents.flatMap((document) => document.runs.filter((run) => run.state === "active"));
  const latestActive = activeRuns.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))[0];

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setDeleteError(null);
    try { await onDeleteDocument(deleteTarget.id); setDeleteTarget(null); }
    catch (failure) { setDeleteError(failure instanceof Error ? failure.message : "The document could not be deleted. Try again."); }
    finally { setDeleting(false); }
  }

  return (
    <div className="local-library-view" role="region" aria-label="Point Nemo local study library">
      <header className="library-header pixel-panel">
        <div className="library-branding"><div className="brand-dot" aria-hidden="true" /><div>
          <h1 className="library-title">POINT NEMO</h1><p className="library-subtitle">ONE LOCAL USER · STUDY RECORDS ON THIS LAPTOP</p>
        </div></div>
        <div className="library-header-actions">
          <div className="user-explorer-pill" title="An optional display name for this shared local library">
            <span>EXPLORER: {currentUser.displayName}</span>
            <button type="button" className="logout-link-btn" onClick={onChangeName}>CHANGE NAME</button>
          </div>
          <div className={`status-badge ${status.api.available ? "is-online" : "is-offline"}`} title={status.api.message}>
            <span className="status-dot" /><span className="status-label">{status.api.available ? "LOCAL API CONNECTED" : "LOCAL API UNAVAILABLE"}</span>
          </div>
          <GameButton size="sm" onClick={onOpenSettings}>⚙ SETTINGS</GameButton>
          <GameButton size="sm" onClick={onRefresh} disabled={!!busy}>REFRESH LIBRARY</GameButton>
          <GameButton variant="primary" onClick={onUploadClick} disabled={!!busy}>+ UPLOAD PDF · FRESH QUESTIONS</GameButton>
        </div>
      </header>
      <p className="intake-copy">{status.ai.message} Saved compatible lessons can be used without generating new questions.</p>
      {error && <div className="upload-error-banner" role="alert">Could not refresh the local library: {error} <GameButton size="sm" onClick={onRefresh}>RETRY</GameButton></div>}
      {latestActive && <section className="resume-run-card pixel-panel" aria-label="Most recently updated active run">
        <div className="resume-card-body"><div><span className="resume-badge">EXPEDITION IN PROGRESS</span>
          <h2 className="resume-title">{latestActive.filename}</h2><p className="resume-meta">Last saved: {new Date(latestActive.updatedAt || latestActive.createdAt).toLocaleString()}</p>
        </div><GameButton variant="primary" disabled={!!busy} onClick={() => onResumeRun(latestActive.id)}>RESUME RUN</GameButton></div>
      </section>}
      <main className="library-content-area">
        <div className="admission-limits-card">
          <span className="limits-header">SUPPORTED UPLOADS</span>
          <p>One English text-based PDF · at most 5 MiB, 3 pages, and 8,000 normalized characters · at least 300 non-whitespace characters.</p>
          <p>No OCR or scans. Figures and image-dependent content are not interpreted. The local server checks the full source and model input budget.</p>
          <p>Every upload requests fresh generation. Saved questions are a separate, explicit choice. No sample lesson is bundled.</p>
        </div>
        {documents.length === 0 && !error && <div className="library-empty-state pixel-panel">
          <h2 className="empty-title">YOUR DESCENT BEGINS WITH ONE SHORT PDF</h2>
          <p className="empty-description">Upload an excerpt to generate three topics and nine questions with supporting passages. AI-generated answers should be reviewed against the source.</p>
          <GameButton variant="primary" size="lg" onClick={onUploadClick}>UPLOAD PDF · GENERATE FRESH QUESTIONS</GameButton>
        </div>}
        {documents.length > 0 && <div className="saved-materials-section">
          <div className="section-title-bar"><h2>LOCAL DOCUMENTS ({documents.length})</h2><span className="section-caption">SAVED QUESTIONS AND RUNS</span></div>
          <div className="runs-grid">{documents.map((document) => <article key={document.id} className="run-card pixel-panel">
            <div className="run-card-header"><h3 className="run-doc-name">{document.filename}</h3><span className="run-date">Updated {new Date(document.updatedAt).toLocaleString()}</span></div>
            <p>{document.pageCount} pages · {document.normalizedCharacterCount.toLocaleString()} normalized characters</p>
            <div className="saved-question-sets" aria-label={`Saved questions for ${document.filename}`}>
              <h4>SAVED LESSONS ({document.questionSets.length})</h4>
              {document.questionSets.length === 0 && <p>No saved questions yet. Generation status is recorded below.</p>}
              {document.questionSets.map((questions) => <div key={questions.id} className="admission-limits-card">
                <p><b>Saved questions</b> · Generated {new Date(questions.createdAt).toLocaleString()}</p>
                <p>{questions.topics.join(" · ")} · 9 questions</p>
                <p>{questions.compatible ? "Compatible with the current local configuration." : "Incompatible with the current local configuration. Upload the PDF for fresh generation."}</p>
                <GameButton variant="primary" size="sm" disabled={!!busy || !questions.compatible} onClick={() => onUseSaved(questions.id)}>USE SAVED QUESTIONS · NEW RUN</GameButton>
              </div>)}
            </div>
            {document.jobs.length > 0 && <div aria-label={`Generation jobs for ${document.filename}`}>
              <h4>GENERATION JOBS</h4>
              {document.jobs.map((job) => <div key={job.id} className="admission-limits-card">
                <p><b>{job.state.toUpperCase()}</b> · {new Date(job.createdAt).toLocaleString()}{job.elapsedTimeMs !== undefined ? ` · ${(job.elapsedTimeMs / 1000).toFixed(1)}s` : ""}{job.retryCount !== undefined ? ` · repairs: ${job.retryCount}` : ""}</p>
                {job.errorMessage && <p role="status">{job.errorStage ? `${job.errorStage}: ` : ""}{job.errorMessage}{job.errorCode ? ` (${job.errorCode})` : ""}</p>}
                {["extracting", "generating", "validating"].includes(job.state) && <GameButton size="sm" variant="danger" disabled={!!busy} onClick={() => onCancelJob(job.id)}>CANCEL GENERATION</GameButton>}
              </div>)}
            </div>}
            <div aria-label={`Saved runs for ${document.filename}`}>
              <h4>RUNS ({document.runs.length})</h4>
              {document.runs.length === 0 && <p>No runs yet. Choose a compatible saved lesson above.</p>}
              {document.runs.map((detail) => {
                const questions = document.questionSets.find((set) => set.id === detail.questionSetId);
                const run = toDescentRun(detail, questions);
                return <div key={run.id} className="admission-limits-card">
                  <p><b>{run.status === "active" ? `${run.stage.toUpperCase()} · IN PROGRESS` : run.status === "completed" ? "DESCENT COMPLETE" : `ENDED AT ${run.failureStage?.toUpperCase() || "UNKNOWN STAGE"}`}</b> · {run.xp} XP</p>
                  <p>Last saved: {new Date(run.updatedAt).toLocaleString()}</p>
                  {run.failureReason && <p>{run.failureReason}</p>}
                  <div className="run-card-actions">
                    {run.status === "active" ? <GameButton variant="primary" size="sm" disabled={!!busy} onClick={() => onResumeRun(run.id)}>RESUME</GameButton>
                      : <><GameButton size="sm" disabled={!!busy} onClick={() => onViewResults(run.id)}>VIEW RESULT</GameButton>
                        <GameButton variant="primary" size="sm" disabled={!!busy || !questions?.compatible} onClick={() => onTryAgain(run.id)}>TRY AGAIN · SAME SAVED SET</GameButton></>}
                  </div>
                </div>;
              })}
            </div>
            <GameButton variant="danger" size="sm" disabled={!!busy} onClick={() => { setDeleteTarget(document); setDeleteError(null); }}>DELETE DOCUMENT AND PROGRESS</GameButton>
          </article>)}</div>
        </div>}
      </main>
      <ConfirmDialog isOpen={deleteTarget !== null} title="DELETE DOCUMENT AND PROGRESS"
        message={`Remove ${deleteTarget?.filename || "this document"}, its extracted passages, all saved question sets, jobs, runs, and attempts from this app's local database. Related generation will stop. This does not erase OS backups.`}
        confirmLabel={deleting ? "DELETING…" : "DELETE DOCUMENT AND PROGRESS"} isDestructive busy={deleting} error={deleteError}
        onConfirm={() => void confirmDelete()} onCancel={() => { if (!deleting) setDeleteTarget(null); }} />
    </div>
  );
}
