interface GameplayResultsViewProps {
  partsCleared: number;
  bossScore: number;
  totalBossQuestions: number;
  earnedXP: number;
  completed: boolean;
  onReturnToLibrary: () => void;
  onChooseSea: () => void;
  onRetryLesson: () => void;
}

export function GameplayResultsView({
  partsCleared,
  bossScore,
  totalBossQuestions,
  earnedXP,
  completed,
  onReturnToLibrary,
  onChooseSea,
  onRetryLesson,
}: GameplayResultsViewProps) {
  const passed = completed && partsCleared===3 && totalBossQuestions>0 && bossScore >= Math.ceil(totalBossQuestions*8/9);

  return (
    <section className="gameplay-results-view" aria-labelledby="results-title">
      <div className="eyebrow">MODULE 05 · EXPEDITION SUMMARY</div>

      <div className="panel results-panel">
        <div className="badge-mark" aria-hidden="true">
          ✦
        </div>

        <p className="eyebrow center-eyebrow">
          {passed ? "DESCENT COMPLETE · APEX CONQUERED" : "DESCENT CONCLUDED · RETRY SUGGESTED"}
        </p>

        <h1 id="results-title">{passed ? "Point Nemo Reached!" : "Submersible Returned"}</h1>

        <p className="muted" style={{ margin: "10px auto 0", maxWidth: "420px" }}>
          {passed
            ? "You completed all lesson parts and met the final review threshold."
            : "The required score was not reached. Review the answer explanations and source notes, then try again."}
        </p>

        <div className="score-grid">
          <div>
            <b>{partsCleared} / 3</b>
            <span>LESSON PARTS</span>
          </div>
          <div>
            <b>{bossScore} / {totalBossQuestions}</b>
            <span>FINAL REVIEW</span>
          </div>
          <div>
            <b>+{earnedXP}</b>
            <span>EXPEDITION XP</span>
          </div>
        </div>

        <div className="results-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onRetryLesson}
          >
            Retry Lesson
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onChooseSea}
          >
            Choose Sea
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onReturnToLibrary}
          >
            Return to Library <span>→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
