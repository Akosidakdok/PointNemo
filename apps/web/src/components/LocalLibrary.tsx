import { useState } from "react";
import { type DescentRun, type QuestionSet } from "@point-nemo/shared";
import { GameButton } from "./ui/GameButton";
import { ConfirmDialog } from "./ConfirmDialog";

export interface LocalLibraryProps {
  runs: DescentRun[];
  questionSets: QuestionSet[];
  activeRun: DescentRun | null;
  onUploadClick: () => void;
  onResumeRun: (runId: string) => void;
  onTryAgain: (runId: string) => void;
  onViewResults: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
  isOnline: boolean;
  onOpenSettings: () => void;
  currentUser?: { displayName: string; email: string } | null;
  onLogout?: () => void;
}

export function LocalLibrary({
  runs,
  questionSets,
  activeRun,
  onUploadClick,
  onResumeRun,
  onTryAgain,
  onViewResults,
  onDeleteRun,
  isOnline,
  onOpenSettings,
  currentUser,
  onLogout,
}: LocalLibraryProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const hasRuns = runs.length > 0;

  return (
    <div className="local-library-view" role="region" aria-label="Point Nemo Local Study Library">
      {/* Top Header */}
      <header className="library-header pixel-panel">
        <div className="library-branding">
          <div className="brand-dot" aria-hidden="true" />
          <div>
            <h1 className="library-title">POINT NEMO</h1>
            <p className="library-subtitle">LOCAL-FIRST OCEAN DESCENT · SOURCE-GROUNDED STUDY EXPEDITION</p>
          </div>
        </div>

        <div className="library-header-actions">
          {currentUser && (
            <div className="user-explorer-pill" title={`Logged in as ${currentUser.email}`}>
              <span className="explorer-status-dot" aria-hidden="true" />
              <span>EXPLORER: {currentUser.displayName.toUpperCase()}</span>
              {onLogout && (
                <button type="button" className="logout-link-btn" onClick={onLogout} aria-label="Log out explorer">
                  EXIT
                </button>
              )}
            </div>
          )}

          <div className={`status-badge ${isOnline ? "is-online" : "is-offline"}`} title={isOnline ? "Local Systems Online" : "Operating Offline"}>
            <span className="status-dot" />
            <span className="status-label">{isOnline ? "LOCAL SYSTEMS READY" : "OFFLINE RUNTIME"}</span>
          </div>
          <GameButton variant="secondary" size="sm" onClick={onOpenSettings} aria-label="Open systems settings">
            ⚙ SYS
          </GameButton>
          <GameButton variant="primary" size="md" onClick={onUploadClick} className="upload-header-btn">
            + UPLOAD PDF
          </GameButton>
        </div>
      </header>

      {/* Prominent Active Resume Card */}
      {activeRun && (
        <section className="resume-run-card pixel-panel" aria-label="Active expedition run">
          <div className="resume-card-glow" aria-hidden="true" />
          <div className="resume-card-body">
            <div>
              <span className="resume-badge">● EXPEDITION IN PROGRESS</span>
              <h2 className="resume-title">ACTIVE DESCENT: {activeRun.documentName}</h2>
              <p className="resume-meta">
                CURRENT ZONE: <b>{activeRun.stage.toUpperCase()}</b> · QUESTION{" "}
                <b>{activeRun.currentQuestionIndex + 1}</b> · HULL <b>{activeRun.playerHp}%</b> · XP <b>{activeRun.xp}</b>
              </p>
            </div>
            <GameButton
              variant="primary"
              size="lg"
              onClick={() => onResumeRun(activeRun.id)}
              className="resume-cta-btn"
            >
              ▶ RESUME RUN
            </GameButton>
          </div>
        </section>
      )}

      {/* Main Content: Empty State OR Runs List */}
      <main className="library-content-area">
        {!hasRuns ? (
          <div className="library-empty-state pixel-panel">
            <div className="empty-radar-icon" aria-hidden="true">
              <span className="radar-ring-1" />
              <span className="radar-ring-2" />
              <span className="radar-center-blip" />
            </div>

            <h2 className="empty-title">YOUR DESCENT BEGINS WITH ONE SHORT PDF</h2>
            <p className="empty-description">
              Upload a single English text document to extract source knowledge, calibrate 9 source-grounded questions,
              and descend through the Hadal abyss.
            </p>

            <div className="empty-cta-wrap">
              <GameButton variant="primary" size="lg" onClick={onUploadClick} className="empty-upload-btn">
                UPLOAD PDF
              </GameButton>
            </div>

            <div className="admission-limits-card">
              <span className="limits-header">DOCUMENT ADMISSION RULES</span>
              <ul className="limits-list">
                <li><span>FILE COUNT:</span> <b>1 PDF document</b></li>
                <li><span>FILE SIZE:</span> <b>No limit</b></li>
                <li><span>PAGE LIMIT:</span> <b>No page limit</b></li>
                <li><span>LANGUAGE:</span> <b>English text-based</b></li>
                <li><span>CONTENT:</span> <b>Minimum 300 text characters (no OCR/scans)</b></li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="saved-materials-section">
            <div className="section-title-bar">
              <h2>LOCAL STUDY ARCHIVE ({runs.length})</h2>
              <span className="section-caption">LOCALLY STORED IN SQLITE // NO CLOUD TRANSMISSION</span>
            </div>

            <div className="runs-grid">
              {runs.map((run) => {
                const qSet = questionSets.find((qs) => qs.id === run.questionSetId);
                const isCompleted = run.status === "completed";
                const isActive = run.status === "active";

                return (
                  <article key={run.id} className="run-card pixel-panel">
                    <div className="run-card-header">
                      <div>
                        <span className={`run-status-tag status-${run.status}`}>
                          {isActive
                            ? "IN PROGRESS"
                            : isCompleted
                            ? "DESCENT COMPLETE"
                            : "DESCENT ENDED"}
                        </span>
                        <h3 className="run-doc-name">{run.documentName}</h3>
                      </div>
                      <span className="run-date">{new Date(run.updatedAt).toLocaleDateString()}</span>
                    </div>

                    <div className="run-card-stats">
                      <div className="run-stat-item">
                        <span>STAGE</span>
                        <b>{run.stage.toUpperCase()}</b>
                      </div>
                      <div className="run-stat-item">
                        <span>XP EARNED</span>
                        <b>{run.xp}</b>
                      </div>
                      <div className="run-stat-item">
                        <span>SURFACE</span>
                        <b>{run.zoneScores.surface}/3</b>
                      </div>
                      <div className="run-stat-item">
                        <span>TWILIGHT</span>
                        <b>{run.zoneScores.twilight}/3</b>
                      </div>
                      <div className="run-stat-item">
                        <span>MIDNIGHT</span>
                        <b>{run.zoneScores.midnight}/3</b>
                      </div>
                      {run.zoneScores.boss !== undefined && (
                        <div className="run-stat-item">
                          <span>BOSS</span>
                          <b>{run.zoneScores.boss}/9</b>
                        </div>
                      )}
                    </div>

                    {qSet && (
                      <div className="run-topics-list">
                        <span>TOPICS:</span> {qSet.topics.join(" · ")}
                      </div>
                    )}

                    {run.failureReason && (
                      <p className="run-failure-note">
                        <b>THRESHOLD:</b> {run.failureReason}
                      </p>
                    )}

                    <div className="run-card-actions">
                      {isActive ? (
                        <GameButton variant="primary" size="sm" onClick={() => onResumeRun(run.id)}>
                          ▶ RESUME
                        </GameButton>
                      ) : (
                        <>
                          <GameButton variant="primary" size="sm" onClick={() => onTryAgain(run.id)}>
                            ↺ TRY AGAIN
                          </GameButton>
                          <GameButton variant="secondary" size="sm" onClick={() => onViewResults(run.id)}>
                            VIEW RESULT
                          </GameButton>
                        </>
                      )}
                      <GameButton
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTargetId(run.id)}
                        aria-label={`Delete ${run.documentName}`}
                      >
                        DELETE
                      </GameButton>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        title="DELETE LOCAL EXPEDITION"
        message="This will permanently delete this document's extracted passages, validated questions, run attempts, and study history from this device."
        confirmLabel="DELETE FOREVER"
        isDestructive={true}
        onConfirm={() => {
          if (deleteTargetId) {
            onDeleteRun(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
