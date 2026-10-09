import { useState } from "react";
import {
  submitAnswer,
  type AnswerFeedback,
  type RunDetail,
} from "../api";

interface AuthoritativeBattleProps {
  run: RunDetail;
  onRunUpdated: (run: RunDetail) => void;
  onNewRun: () => void;
  onRetryQuestionSet?: (questionSetId: string) => void;
}

const encounterData = {
  surface: {
    creature: "Clownfish",
    depth: "SURFACE ZONE · 0–200 M",
    maxEnemyHp: 100,
    icon: "◌",
  },
  twilight: {
    creature: "Anglerfish",
    depth: "TWILIGHT ZONE · 200–1,000 M",
    maxEnemyHp: 100,
    icon: "◉",
  },
  midnight: {
    creature: "Giant Squid",
    depth: "MIDNIGHT ZONE · 1,000–4,000 M",
    maxEnemyHp: 100,
    icon: "◈",
  },
  boss: {
    creature: "Megalodon",
    depth: "POINT NEMO TRENCH · 10,935 M",
    maxEnemyHp: 80,
    icon: "✦",
  },
} as const;

export function AuthoritativeBattle({
  run,
  onRunUpdated,
  onNewRun,
  onRetryQuestionSet,
}: AuthoritativeBattleProps) {
  const [submitting, setSubmitting] = useState(false);
  const [displayedFeedback, setDisplayedFeedback] = useState<AnswerFeedback | null>(null);
  const [pendingNextRun, setPendingNextRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentEncounterType = run.currentSlot?.encounterType ?? (run.currentSlotIndex >= 9 ? "boss" : "midnight");
  const encInfo = encounterData[currentEncounterType];
  const maxEnemyHp = encInfo.maxEnemyHp;

  async function handleSelectOption(optionIndex: number) {
    if (!run.currentSlot || submitting || displayedFeedback) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitAnswer(run.id, run.currentSlot.id, optionIndex);
      setDisplayedFeedback(result.feedback);
      setPendingNextRun(result.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit answer.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    if (pendingNextRun) {
      onRunUpdated(pendingNextRun);
      setPendingNextRun(null);
    }
    setDisplayedFeedback(null);
  }

  // Finished states
  if (run.state === "completed") {
    return (
      <section className="battle-card battle-won" aria-labelledby="battle-title">
        <div className="battle-topline">
          <div>
            <p className="eyebrow">EXPEDITION COMPLETE</p>
            <h2 id="battle-title">Descent Complete</h2>
          </div>
          <span className="turn-indicator turn-won">SURVIVED</span>
        </div>

        <div className="result-badge">
          <span aria-hidden="true">✦</span> DESCENT COMPLETE
        </div>

        <p className="result-copy">
          You reached the Megalodon trench and conquered Point Nemo. You cleared all three depth zones and passed the final boss review with {run.xp} / 180 XP.
        </p>

        <div className="run-stats-strip">
          <span>FINAL XP: <b>{run.xp}</b></span>
          <span>SLOTS RESOLVED: <b>18 / 18</b></span>
          <span>HULL: <b>{run.playerHp}%</b></span>
        </div>

        <div className="battle-actions">
          <button className="attack-button" type="button" onClick={onNewRun}>
            <span>↳</span> Start new expedition <kbd>ENTER</kbd>
          </button>
        </div>
      </section>
    );
  }

  if (run.state === "failed") {
    const mistakes = run.attempts?.filter((a) => !a.isCorrect) ?? [];
    return (
      <section className="battle-card" aria-labelledby="battle-title">
        <div className="battle-topline">
          <div>
            <p className="eyebrow">HULL PRESSURE CRITICAL</p>
            <h2 id="battle-title">Expedition Failed</h2>
          </div>
          <span className="turn-indicator turn-lost">DEFEATED</span>
        </div>

        <div className="result-badge badge-failed">
          <span aria-hidden="true">✕</span> SUBMERSIBLE CRUSHED
        </div>

        <p className="result-copy">
          Pressure breached the hull at slot {run.currentSlotIndex} of 18. Review your missed topics and supporting evidence below before diving again.
        </p>

        <div className="run-stats-strip">
          <span>XP EARNED: <b>{run.xp}</b></span>
          <span>DEPTH REACHED: <b>{encInfo.depth}</b></span>
          <span>MISSED: <b>{mistakes.length}</b></span>
        </div>

        {mistakes.length > 0 && (
          <div>
            <p className="eyebrow" style={{ marginTop: 12 }}>MISTAKES & SOURCE EVIDENCE</p>
            <div className="mistakes-list">
              {mistakes.map((m, idx) => (
                <div key={idx} className="mistake-item">
                  <b>{m.topicName.toUpperCase()} · {m.questionPrompt}</b>
                  <p style={{ margin: "4px 0" }}>{m.feedback.explanation}</p>
                  {m.feedback.evidence?.[0] && (
                    <span style={{ fontSize: "8px", color: "var(--mint)" }}>
                      Source (p.{m.feedback.evidence[0].pageNumber}): “{m.feedback.evidence[0].quote}”
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="battle-actions" style={{ marginTop: 14 }}>
          {onRetryQuestionSet && (
            <button
              className="attack-button"
              type="button"
              onClick={() => onRetryQuestionSet(run.questionSetId)}
            >
              <span>⌁</span> Try again (same lesson)
            </button>
          )}
          <button className="reset-button" type="button" onClick={onNewRun}>
            Back to map
          </button>
        </div>
      </section>
    );
  }

  const slot = run.currentSlot;

  return (
    <section className="battle-card" aria-labelledby="battle-title">
      <div className="battle-topline">
        <div>
          <p className="eyebrow">{currentEncounterType === "boss" ? "POINT NEMO BOSS ENCOUNTER" : "AUTHORITATIVE ENCOUNTER"}</p>
          <h2 id="battle-title">{encInfo.creature} encounter</h2>
        </div>
        <span className="turn-indicator" aria-live="polite">
          {displayedFeedback
            ? displayedFeedback.isCorrect ? "CORRECT" : "DAMAGED"
            : `SLOT ${run.currentSlotIndex + 1} / 18`}
        </span>
      </div>

      <div className="run-stats-strip">
        <span>ZONE: <b>{currentEncounterType.toUpperCase()}</b></span>
        <span>XP: <b>{run.xp}</b></span>
        <span>COMBO: <b>{run.combo}x</b></span>
      </div>

      {currentEncounterType === "boss" && (
        <div style={{ background: "rgba(208, 237, 139, 0.08)", border: "1px dashed rgba(208, 237, 139, 0.3)", padding: "6px 8px", fontSize: "8px", color: "var(--acid)", fontFamily: "var(--mono)", marginBottom: 10 }}>
          MIXED-TOPIC REVIEW: PREVIOUSLY ENCOUNTERED QUESTIONS (8/9 TO PASS)
        </div>
      )}

      {/* HP Meters */}
      <div className="combatants">
        <div className="combatant">
          <div className="combatant-name"><span>◌</span> NAUTILUS-01 <b>PLAYER</b></div>
          <div className="health-track" role="progressbar" aria-label="Submersible health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={run.playerHp}>
            <div className="health-fill player-health" style={{ width: `${Math.max(0, Math.min(100, run.playerHp))}%` }} />
          </div>
          <span className="health-label">HULL INTEGRITY <b>{run.playerHp} / 100</b></span>
        </div>
        <div className="combatant">
          <div className="combatant-name"><span>{encInfo.icon}</span> {encInfo.creature.toUpperCase()} <b>THREAT</b></div>
          <div className="health-track" role="progressbar" aria-label="Enemy threat" aria-valuemin={0} aria-valuemax={maxEnemyHp} aria-valuenow={run.currentEncounterHp}>
            <div className="health-fill enemy-health" style={{ width: `${Math.max(0, Math.min(100, (run.currentEncounterHp / maxEnemyHp) * 100))}%` }} />
          </div>
          <span className="health-label">THREAT LEVEL <b>{run.currentEncounterHp} / {maxEnemyHp}</b></span>
        </div>
      </div>

      {/* Active Question & Options */}
      {slot && !displayedFeedback && (
        <div className="run-question-card">
          <div className="question-meta">
            <span>{slot.question.topicName.toUpperCase()}</span>
            <span className="difficulty-tag">{slot.question.difficulty.toUpperCase()}</span>
          </div>
          <p className="question-prompt">{slot.question.prompt}</p>

          <div className="options-grid" role="group" aria-label="Answer options">
            {slot.question.options.map((option, index) => (
              <button
                key={index}
                className="option-button"
                type="button"
                disabled={submitting}
                onClick={() => void handleSelectOption(index)}
              >
                <span className="option-index">[{String.fromCharCode(65 + index)}]</span>
                <span className="option-text">{option}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Answer Feedback Card */}
      {displayedFeedback && (
        <div className={`feedback-panel ${displayedFeedback.isCorrect ? "feedback-correct" : "feedback-incorrect"}`} aria-live="polite">
          <div className="feedback-header">
            <span>{displayedFeedback.isCorrect ? "✓ ANSWER VERIFIED" : "✕ INCORRECT"}</span>
            <span>{displayedFeedback.isCorrect ? `+${displayedFeedback.enemyDamageTaken} DMG · +${displayedFeedback.xpAwarded} XP` : `-${displayedFeedback.playerDamageTaken} HULL`}</span>
          </div>
          <p className="feedback-explanation">{displayedFeedback.explanation}</p>
          {displayedFeedback.evidence?.map((ev, i) => (
            <div key={i} className="feedback-quote">
              “{ev.quote}”
              <small>Supporting passage · Page {ev.pageNumber} · Chunk {ev.chunkId}</small>
            </div>
          ))}

          <div className="battle-actions" style={{ marginTop: 12 }}>
            <button className="attack-button" type="button" onClick={handleContinue}>
              Continue to next encounter <kbd>ENTER</kbd>
            </button>
          </div>
        </div>
      )}

      {error && <p className="intake-error">{error}</p>}

      <p className="battle-footnote">{encInfo.depth} · NO CLOUD INFERENCE</p>
    </section>
  );
}
