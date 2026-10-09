import { useState, useEffect, useRef } from "react";
import {
  type DescentRun,
  type QuestionSet,
  type PointNemoQuestion,
  type DescentZone,
} from "@point-nemo/shared";
import { type AssetBundle, speciesScale, SpriteAnimation } from "../game/sprites";
import { GameButton } from "./ui/GameButton";

export interface DescentEncounterProps {
  run: DescentRun;
  questionSet: QuestionSet;
  bundle: AssetBundle | null;
  onAnswerSubmit: (selectedAnswer: number) => Promise<void>;
  reducedMotion?: boolean;
}

const ZONE_METADATA: Record<
  DescentZone,
  {
    name: string;
    enemyName: string;
    depthLabel: string;
    difficultyLabel: string;
    passRule: string;
    totalQuestions: number;
    targetPass: number;
    enemyColor: string;
  }
> = {
  surface: {
    name: "SURFACE ZONE",
    enemyName: "CLOWNFISH",
    depthLabel: "0M – 200M (EUPHOTIC)",
    difficultyLabel: "EASY",
    passRule: "At least 2 of 3 correct required to descend",
    totalQuestions: 3,
    targetPass: 2,
    enemyColor: "#e6b957",
  },
  twilight: {
    name: "TWILIGHT ZONE",
    enemyName: "ANGLERFISH",
    depthLabel: "200M – 1,000M (MESOPELAGIC)",
    difficultyLabel: "MEDIUM",
    passRule: "At least 2 of 3 correct required to descend",
    totalQuestions: 3,
    targetPass: 2,
    enemyColor: "#30d6f2",
  },
  midnight: {
    name: "MIDNIGHT ZONE",
    enemyName: "GIANT SQUID",
    depthLabel: "1,000M – 4,000M (BATHYPELAGIC)",
    difficultyLabel: "HARD",
    passRule: "At least 2 of 3 correct required to reach Point Nemo",
    totalQuestions: 3,
    targetPass: 2,
    enemyColor: "#d98eaa",
  },
  boss: {
    name: "POINT NEMO BOSS",
    enemyName: "MEGALODON",
    depthLabel: "10,935M (HADAL TRENCH APEX)",
    difficultyLabel: "MIXED-TOPIC REVIEW",
    passRule: "At least 8 of 9 correct required to complete descent",
    totalQuestions: 9,
    targetPass: 8,
    enemyColor: "#ff4853",
  },
  results: {
    name: "EXPEDITION COMPLETE",
    enemyName: "NONE",
    depthLabel: "BATHYAL RECOVERY",
    difficultyLabel: "SUMMARY",
    passRule: "",
    totalQuestions: 0,
    targetPass: 0,
    enemyColor: "#eaf4fc",
  },
};

export function DescentEncounter({
  run,
  questionSet,
  bundle,
  onAnswerSubmit,
  reducedMotion = false,
}: DescentEncounterProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackActive, setFeedbackActive] = useState(false);
  const [lastAnswerRecord, setLastAnswerRecord] = useState<{
    isCorrect: boolean;
    selectedAnswer: number;
    question: PointNemoQuestion;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zoneInfo = ZONE_METADATA[run.stage] || ZONE_METADATA.surface;

  // Determine active question
  let currentQuestion: PointNemoQuestion | undefined;
  if (run.stage === "surface") {
    currentQuestion = questionSet.questions.filter((q) => q.difficulty === "easy")[run.currentQuestionIndex];
  } else if (run.stage === "twilight") {
    currentQuestion = questionSet.questions.filter((q) => q.difficulty === "medium")[run.currentQuestionIndex];
  } else if (run.stage === "midnight") {
    currentQuestion = questionSet.questions.filter((q) => q.difficulty === "hard")[run.currentQuestionIndex];
  } else if (run.stage === "boss") {
    const qId = run.shuffledBossOrder[run.currentQuestionIndex];
    currentQuestion = questionSet.questions.find((q) => q.id === qId);
  }

  // Current zone attempts count & correct count
  const stageAttempts = run.attempts.filter((a) => a.zone === run.stage);
  const correctSoFar = stageAttempts.filter((a) => a.isCorrect).length;
  const questionNumber = Math.min(zoneInfo.totalQuestions, run.currentQuestionIndex + 1);

  // Keyboard navigation for options: A/1, B/2, C/3, D/4 and Enter
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (feedbackActive) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleDismissFeedback();
        }
        return;
      }

      if (e.key === "1" || e.key === "a" || e.key === "A") {
        setSelectedOption(0);
      } else if (e.key === "2" || e.key === "b" || e.key === "B") {
        setSelectedOption(1);
      } else if (e.key === "3" || e.key === "c" || e.key === "C") {
        setSelectedOption(2);
      } else if (e.key === "4" || e.key === "d" || e.key === "D") {
        setSelectedOption(3);
      } else if (e.key === "Enter" && selectedOption !== null && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedOption, feedbackActive, isSubmitting]);

  // Canvas drawing for combatants
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bundle) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;
    let lastFrame = performance.now();
    const explorerSwim = new SpriteAnimation(bundle, "explorer.swim.right");
    const enemyAnimationByStage: Record<Exclude<DescentZone, "results">, string> = {
      surface: "blobfish.swim.left",
      twilight: "barreleye.swim",
      midnight: "gulper.swim",
      boss: "goblin.swim",
    };
    const enemySpeciesByStage: Record<Exclude<DescentZone, "results">, string> = {
      surface: "blobfish",
      twilight: "barreleye",
      midnight: "gulper",
      boss: "goblin",
    };
    const encounterStage = run.stage === "results" ? null : run.stage;
    const enemySwim = encounterStage ? new SpriteAnimation(bundle, enemyAnimationByStage[encounterStage]) : null;
    const fringeheadSwim = run.stage === "boss" ? new SpriteAnimation(bundle, "fringehead.swim") : null;

    const render = (now: number) => {
      const dt = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;
      if (!reducedMotion) {
        t += dt;
        explorerSwim.update(dt);
        enemySwim?.update(dt);
        fringeheadSwim?.update(dt);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      // Deep water gradient
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, "#061426");
      grad.addColorStop(1, "#0b1e38");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Depth grid
      ctx.strokeStyle = "rgba(66, 104, 135, 0.2)";
      ctx.lineWidth = 1;
      for (let y = 14; y < canvas.height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Player Submersible (Explorer)
      const explorerScale = speciesScale(bundle, "explorer", 64);
      const playerY = Math.round(canvas.height * 0.55 + (reducedMotion ? 0 : Math.sin(t * 1.2) * 2));
      explorerSwim.draw(ctx, 70, playerY, explorerScale);

      // Draw Enemy Silhouette / Sprite
      const enemyX = Math.round(canvas.width - 80);
      const enemyY = Math.round(canvas.height * 0.55 + (reducedMotion ? 0 : Math.cos(t * 0.85) * 3));
      if (enemySwim && encounterStage) {
        const enemyScale = speciesScale(bundle, enemySpeciesByStage[encounterStage], run.stage === "boss" ? 84 : 68);
        enemySwim.draw(ctx, enemyX, enemyY, enemyScale);
      }

      // The prepared fringehead swim loop joins the apex scene as distant life.
      if (fringeheadSwim) {
        fringeheadSwim.draw(ctx, Math.round(canvas.width * 0.62), Math.round(canvas.height * 0.28), speciesScale(bundle, "fringehead", 44));
      }

      if (!reducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    render(performance.now());
    return () => cancelAnimationFrame(animId);
  }, [bundle, run.stage, reducedMotion]);

  async function handleSubmit() {
    if (selectedOption === null || !currentQuestion || isSubmitting) return;

    setIsSubmitting(true);
    const chosen = selectedOption;
    const isCorrect = chosen === currentQuestion.answerIndex;

    setLastAnswerRecord({
      isCorrect,
      selectedAnswer: chosen,
      question: currentQuestion,
    });
    setFeedbackActive(true);

    try {
      await onAnswerSubmit(chosen);
    } catch (err) {
      console.error("Failed to submit answer:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDismissFeedback() {
    setFeedbackActive(false);
    setSelectedOption(null);
  }

  if (!currentQuestion) {
    return (
      <div className="encounter-loading-card pixel-panel">
        <p>CALIBRATING ENCOUNTER TELEMETRY…</p>
      </div>
    );
  }

  const optionLetters = ["A", "B", "C", "D"];

  return (
    <div className="descent-encounter-view" role="region" aria-label={`${zoneInfo.name} Encounter`}>
      {/* Top Combat Telemetry HUD */}
      <header className="encounter-top-hud pixel-panel">
        <div className="hud-combatant-status">
          <div className="status-label-group">
            <span className="combatant-icon" aria-hidden="true">⌁</span>
            <span className="combatant-name">SUBMERSIBLE (HULL)</span>
            <b className="combatant-val">{run.playerHp}%</b>
          </div>
          <div
            className="encounter-health-track"
            role="progressbar"
            aria-label="Submersible hull integrity"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={run.playerHp}
          >
            <div className="encounter-health-fill fill-player" style={{ width: `${run.playerHp}%` }} />
          </div>
        </div>

        <div className="hud-zone-badge">
          <span className="zone-name-title">{zoneInfo.name}</span>
          <span className="zone-enemy-tag">{zoneInfo.enemyName} · {zoneInfo.difficultyLabel}</span>
        </div>

        <div className="hud-stats-group">
          <div className="hud-stat-pill">
            <span>QUESTION:</span> <b>{questionNumber} / {zoneInfo.totalQuestions}</b>
          </div>
          <div className="hud-stat-pill">
            <span>SCORE:</span> <b>{correctSoFar} / {questionNumber - (feedbackActive ? 0 : 1)}</b>
          </div>
          <div className="hud-stat-pill target-pill">
            <span>TARGET:</span> <b>{zoneInfo.targetPass} / {zoneInfo.totalQuestions}</b>
          </div>
          <div className="hud-stat-pill xp-pill">
            <span>XP:</span> <b>{run.xp}</b>
          </div>
        </div>
      </header>

      {/* Center 16-Bit Combat Arena Canvas */}
      <div className="encounter-arena-wrap pixel-panel" aria-hidden="true">
        <canvas ref={canvasRef} width={640} height={130} className="encounter-canvas pixel-art" />
        <div className="arena-telemetry-overlay">
          <span>DEPTH: {zoneInfo.depthLabel}</span>
          <span>TARGET SPECIES: {zoneInfo.enemyName}</span>
        </div>
      </div>

      {/* Bottom Educational Learning Card */}
      <main className="encounter-study-panel pixel-panel" aria-live="polite">
        <div className="study-panel-header">
          <span className="question-topic-badge">TOPIC: {currentQuestion.topic.toUpperCase()}</span>
          <span className="question-difficulty-tag">[{currentQuestion.difficulty.toUpperCase()}]</span>
        </div>

        <h2 className="question-prompt-text">{currentQuestion.prompt}</h2>

        {/* 4 Accessible Answer Choices */}
        <div className="answers-choice-grid">
          {currentQuestion.options.map((optionText, index) => {
            const isSelected = selectedOption === index;
            const letter = optionLetters[index];

            return (
              <button
                key={index}
                type="button"
                disabled={feedbackActive || isSubmitting}
                className={`answer-choice-btn ${isSelected ? "is-selected" : ""}`}
                onClick={() => setSelectedOption(index)}
                aria-pressed={isSelected}
              >
                <span className="choice-letter-badge">[{letter}]</span>
                <span className="choice-text">{optionText}</span>
              </button>
            );
          })}
        </div>

        {/* Action Button (Submit) */}
        {!feedbackActive ? (
          <div className="encounter-submit-row">
            <GameButton
              variant="primary"
              size="lg"
              disabled={selectedOption === null || isSubmitting}
              onClick={handleSubmit}
              className="confirm-answer-btn"
            >
              {isSubmitting ? "RESOLVING..." : "CONFIRM ANSWER"} <kbd>ENTER</kbd>
            </GameButton>
            <span className="keyboard-hint">SHORTCUTS: 1, 2, 3, 4 OR A, B, C, D</span>
          </div>
        ) : (
          /* Instant Source-Grounded Feedback Panel */
          <div className={`answer-feedback-panel ${lastAnswerRecord?.isCorrect ? "feedback-correct" : "feedback-incorrect"}`} role="alert">
            <div className="feedback-result-title">
              <span className="feedback-icon">{lastAnswerRecord?.isCorrect ? "✓" : "✕"}</span>
              <b>{lastAnswerRecord?.isCorrect ? "CORRECT! (+10 XP · ENEMY -50 HP)" : "INCORRECT (HULL -50 HP)"}</b>
            </div>

            {!lastAnswerRecord?.isCorrect && (
              <p className="correct-answer-callout">
                CORRECT ANSWER: <b>[{optionLetters[currentQuestion.answerIndex]}] {currentQuestion.options[currentQuestion.answerIndex]}</b>
              </p>
            )}

            <div className="explanation-block">
              <span className="block-label">EXPLANATION:</span>
              <p className="explanation-text">{currentQuestion.explanation}</p>
            </div>

            {/* Mandatory Exact Source Quote & Page Citation */}
            <div className="source-evidence-block">
              <div className="source-evidence-header">
                <span className="source-badge">VERIFIED SOURCE EVIDENCE</span>
                <span className="source-page-tag">PAGE {currentQuestion.sourcePage}</span>
              </div>
              <blockquote className="source-quote-text">
                "{currentQuestion.sourceQuote}"
              </blockquote>
            </div>

            <div className="feedback-action-row">
              <GameButton variant="primary" size="lg" onClick={handleDismissFeedback} className="continue-encounter-btn">
                CONTINUE DESCENT ↗ <kbd>ENTER</kbd>
              </GameButton>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
