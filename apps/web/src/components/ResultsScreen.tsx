import { type DescentRun, type QuestionSet, type PointNemoQuestion } from "@point-nemo/shared";
import { GameButton } from "./ui/GameButton";

export interface ResultsScreenProps {
  run: DescentRun;
  questionSet: QuestionSet;
  onTryAgain: () => void;
  onReturnToLibrary: () => void;
  onStartNewPdf: () => void;
}

export function ResultsScreen({
  run,
  questionSet,
  onTryAgain,
  onReturnToLibrary,
  onStartNewPdf,
}: ResultsScreenProps) {
  const isComplete = run.status === "completed";
  const optionLetters = ["A", "B", "C", "D"];

  // Calculate missed questions
  const missedAttempts = run.attempts.filter((a) => !a.isCorrect);
  const missedQuestionsWithAttempts = missedAttempts
    .map((attempt) => {
      const q = questionSet.questions.find((quest) => quest.id === attempt.questionId);
      return {
        attempt,
        question: q,
      };
    })
    .filter(
      (item): item is { attempt: (typeof missedAttempts)[number]; question: PointNemoQuestion } =>
        item.question !== undefined
    );

  return (
    <div className="results-screen-view" role="region" aria-label="Expedition Results Summary">
      <div className="results-card pixel-panel">
        {/* Header / Badge */}
        <header className="results-header">
          {isComplete ? (
            <div className="badge-showcase" role="img" aria-label="Descent Complete Badge">
              <div className="compass-badge-icon">
                <span className="badge-ring" />
                <span className="badge-needle" />
                <span className="badge-center-gem" />
              </div>
              <h1 className="results-main-title badge-title">DESCENT COMPLETE</h1>
              <p className="results-subtitle">
                POINT NEMO REACHED · HADAL APEX CONQUERED (8+/9 ON MEGALODON REVIEW)
              </p>
            </div>
          ) : (
            <div className="failure-showcase">
              <span className="failure-sonar-blip" aria-hidden="true">✕</span>
              <h1 className="results-main-title failure-title">DESCENT ENDED</h1>
              <p className="results-subtitle">
                EXPEDITION HALTED AT {run.stage.toUpperCase()} DEPTH
              </p>
              {run.failureReason && (
                <div className="failure-reason-callout" role="alert">
                  <b>FAILURE THRESHOLD:</b> {run.failureReason}
                </div>
              )}
            </div>
          )}
        </header>

        {/* Telemetry Scores Grid */}
        <section className="results-scores-grid" aria-label="Zone score breakdown">
          <div className="score-stat-card">
            <span className="score-label">SURFACE ZONE</span>
            <b className={`score-val ${run.zoneScores.surface >= 2 ? "val-pass" : "val-fail"}`}>
              {run.zoneScores.surface} / 3
            </b>
            <span className="score-meta">{run.zoneScores.surface >= 2 ? "CLEARED" : "FAILED"}</span>
          </div>

          <div className="score-stat-card">
            <span className="score-label">TWILIGHT ZONE</span>
            <b className={`score-val ${run.zoneScores.twilight >= 2 ? "val-pass" : "val-fail"}`}>
              {run.zoneScores.twilight} / 3
            </b>
            <span className="score-meta">
              {run.zoneScores.twilight >= 2 ? "CLEARED" : run.zoneScores.surface >= 2 ? "FAILED" : "UNREACHED"}
            </span>
          </div>

          <div className="score-stat-card">
            <span className="score-label">MIDNIGHT ZONE</span>
            <b className={`score-val ${run.zoneScores.midnight >= 2 ? "val-pass" : "val-fail"}`}>
              {run.zoneScores.midnight} / 3
            </b>
            <span className="score-meta">
              {run.zoneScores.midnight >= 2 ? "CLEARED" : run.zoneScores.twilight >= 2 ? "FAILED" : "UNREACHED"}
            </span>
          </div>

          <div className="score-stat-card">
            <span className="score-label">POINT NEMO BOSS</span>
            <b className={`score-val ${(run.zoneScores.boss ?? 0) >= 8 ? "val-pass" : "val-fail"}`}>
              {run.zoneScores.boss !== undefined ? `${run.zoneScores.boss} / 9` : "—"}
            </b>
            <span className="score-meta">
              {(run.zoneScores.boss ?? 0) >= 8
                ? "VICTORY"
                : run.zoneScores.boss !== undefined
                ? "FAILED"
                : "UNREACHED"}
            </span>
          </div>

          <div className="score-stat-card stat-totals">
            <span className="score-label">EXPEDITION XP</span>
            <b className="score-val val-gold">{run.xp} XP</b>
            <span className="score-meta">UNIQUE QUESTIONS: 9 · TOTAL SLOTS: 18</span>
          </div>
        </section>

        {/* Mistake Review Section (Mandatory Source Evidence for errors) */}
        {missedQuestionsWithAttempts.length > 0 ? (
          <section className="mistake-review-section" aria-label="Mistake review">
            <div className="mistake-header-bar">
              <h2>MISTAKE REVIEW & SOURCE CITATIONS ({missedQuestionsWithAttempts.length})</h2>
              <span>VERIFIED AGAINST ORIGINAL PDF PASSAGES</span>
            </div>

            <div className="mistakes-list">
              {missedQuestionsWithAttempts.map(({ attempt, question }, idx) => (
                <article key={idx} className="mistake-item-card">
                  <div className="mistake-item-top">
                    <span className="mistake-zone-tag">[{attempt.zone.toUpperCase()} ZONE]</span>
                    <span className="mistake-topic-tag">TOPIC: {question.topic}</span>
                  </div>

                  <h3 className="mistake-prompt">{question.prompt}</h3>

                  <div className="mistake-answers-comparison">
                    <div className="answer-diff user-diff">
                      <span>YOUR ANSWER:</span>
                      <b>[{optionLetters[attempt.selectedAnswer]}] {question.options[attempt.selectedAnswer]}</b>
                    </div>
                    <div className="answer-diff correct-diff">
                      <span>CORRECT ANSWER:</span>
                      <b>[{optionLetters[question.answerIndex]}] {question.options[question.answerIndex]}</b>
                    </div>
                  </div>

                  <div className="mistake-explanation">
                    <span>EXPLANATION:</span> {question.explanation}
                  </div>

                  {/* Exact source citation */}
                  <div className="mistake-source-quote">
                    <div className="quote-header">
                      <span>SOURCE CITATION</span>
                      <b>PAGE {question.sourcePage}</b>
                    </div>
                    <blockquote>"{question.sourceQuote}"</blockquote>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <div className="flawless-run-banner">
            <span>★</span> FLAWLESS EXPEDITION · ZERO MISTAKES RECORDED!
          </div>
        )}

        {/* Actions Row */}
        <footer className="results-actions-bar">
          <GameButton variant="primary" size="lg" onClick={onTryAgain} className="results-primary-action">
            ↺ TRY AGAIN (SAME QUESTION SET)
          </GameButton>

          {isComplete && (
            <GameButton variant="gold" size="lg" onClick={onStartNewPdf}>
              + START NEW PDF EXPEDITION
            </GameButton>
          )}

          <GameButton variant="secondary" size="lg" onClick={onReturnToLibrary}>
            RETURN TO LOCAL LIBRARY
          </GameButton>
        </footer>
      </div>
    </div>
  );
}
