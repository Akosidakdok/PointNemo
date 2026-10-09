import { type DescentRun, type QuestionSet, type EncounterStage } from "../api";
import { GameButton } from "./ui/GameButton";
import { SourceEvidence } from "./SourceEvidence";

export interface ResultsScreenProps {
  run: DescentRun;
  questionSet: QuestionSet;
  busy?: boolean;
  onTryAgain: () => void;
  onReturnToLibrary: () => void;
  onStartNewPdf: () => void;
}
const zones: { zone: EncounterStage; label: string; count: number; target: number }[] = [
  { zone: "surface", label: "SURFACE", count: 3, target: 2 },
  { zone: "twilight", label: "TWILIGHT", count: 3, target: 2 },
  { zone: "midnight", label: "MIDNIGHT", count: 3, target: 2 },
  { zone: "boss", label: "MIXED-TOPIC BOSS REVIEW", count: 9, target: 8 },
];
const letters = ["A", "B", "C", "D"];

export function ResultsScreen({ run, questionSet, busy = false, onTryAgain, onReturnToLibrary, onStartNewPdf }: ResultsScreenProps) {
  const completed = run.status === "completed";
  const missed = run.attempts.filter((attempt) => !attempt.isCorrect);
  const latest = run.attempts.reduce<(typeof run.attempts)[number] | undefined>((previous, attempt) => !previous || previous.slotIndex < attempt.slotIndex ? attempt : previous, undefined);
  return <div className="results-screen-view" role="region" aria-label="Expedition results">
    <div className="results-card pixel-panel">
      <header className="results-header">
        <h1 className={`results-main-title ${completed ? "badge-title" : "failure-title"}`}>{completed ? "DESCENT COMPLETE" : "DESCENT ENDED"}</h1>
        {completed ? <p className="results-subtitle">Completion badge for this run: three zones cleared and at least 8/9 in the mixed-topic boss review.</p>
          : <><p className="results-subtitle">EXPEDITION ENDED AT {run.failureStage?.toUpperCase() || "AN UNREPORTED STAGE"}</p>{run.failureReason && <p className="failure-reason-callout">{run.failureReason}</p>}</>}
        <p>{run.documentName} · Last saved {new Date(run.updatedAt).toLocaleString()}</p>
        <p>This game uses nine generated questions, followed by a review of the same nine. Completion and XP include repeated practice.</p>
      </header>
      <section className="results-scores-grid" aria-label="Zone score breakdown">
        {zones.map(({ zone, label, count, target }) => {
          const attempts = run.attempts.filter((attempt) => attempt.zone === zone);
          const score = attempts.filter((attempt) => attempt.isCorrect).length;
          const reached = attempts.length > 0;
          return <div key={zone} className="score-stat-card"><span className="score-label">{label}</span><b className={`score-val ${score >= target ? "val-pass" : reached ? "val-fail" : ""}`}>{reached ? `${score} / ${count}` : "—"}</b>
            <span className="score-meta">{!reached ? "UNREACHED" : score >= target ? "CLEARED" : attempts.length === count ? "FAILED" : `${attempts.length} ANSWERED`}</span></div>;
        })}
        <div className="score-stat-card stat-totals"><span className="score-label">EXPEDITION XP</span><b className="score-val val-gold">{run.xp} / 180 XP</b><span className="score-meta">ANSWERED SLOTS: {run.attempts.length} / 18 · UNIQUE ENCOUNTERED: {new Set(run.attempts.map((attempt) => attempt.questionId)).size} / 9</span></div>
      </section>
      {latest && <details className="admission-limits-card"><summary>Latest saved answer · {latest.zone.toUpperCase()} · {latest.isCorrect ? "Correct" : "Incorrect"}</summary>
        <h3>{latest.questionPrompt}</h3><p>Your answer: [{letters[latest.selectedAnswer]}] {latest.options[latest.selectedAnswer]}</p>
        <p>Correct answer: [{letters[latest.feedback.correctAnswerIndex]}] {latest.options[latest.feedback.correctAnswerIndex]}</p><p>{latest.feedback.explanation}</p>
        <SourceEvidence evidence={latest.feedback.evidence} questionSet={questionSet} />
      </details>}
      {missed.length > 0 ? <section className="mistake-review-section" aria-label="Mistake review">
        <div className="mistake-header-bar"><h2>MISTAKE REVIEW ({missed.length})</h2><span>AI-GENERATED FEEDBACK WITH SUPPORTING PASSAGES</span></div>
        <div className="mistakes-list">{missed.map((attempt) => <article key={attempt.slotId} className="mistake-item-card">
          <div className="mistake-item-top"><span className="mistake-zone-tag">{attempt.zone.toUpperCase()}</span><span className="mistake-topic-tag">TOPIC: {attempt.topicName}</span></div>
          <h3 className="mistake-prompt">{attempt.questionPrompt}</h3><div className="mistake-answers-comparison">
            <div className="answer-diff user-diff"><span>YOUR ANSWER:</span><b>[{letters[attempt.selectedAnswer]}] {attempt.options[attempt.selectedAnswer]}</b></div>
            <div className="answer-diff correct-diff"><span>CORRECT ANSWER:</span><b>[{letters[attempt.feedback.correctAnswerIndex]}] {attempt.options[attempt.feedback.correctAnswerIndex]}</b></div>
          </div><p className="mistake-explanation">{attempt.feedback.explanation}</p><SourceEvidence evidence={attempt.feedback.evidence} questionSet={questionSet} />
        </article>)}</div>
      </section> : <p className="flawless-run-banner">{run.attempts.length ? "All recorded answers in this run were correct." : "No answer attempts are recorded."}</p>}
      {!questionSet.compatible && <p>These historical questions are incompatible with the current local configuration. Upload the PDF for fresh questions.</p>}
      <footer className="results-actions-bar">
        <GameButton variant="primary" size="lg" disabled={busy || !questionSet.compatible} onClick={onTryAgain}>TRY AGAIN · SAME SAVED QUESTIONS</GameButton>
        <GameButton variant="gold" size="lg" disabled={busy} onClick={onStartNewPdf}>UPLOAD PDF · FRESH GENERATION</GameButton>
        <GameButton size="lg" disabled={busy} onClick={onReturnToLibrary}>RETURN TO LIBRARY</GameButton>
      </footer>
    </div>
  </div>;
}
