import { useEffect, useRef, useState } from "react";
import {
  type AssetBundle,
  SpriteAnimation,
  drawFrame,
  speciesScale,
} from "../../game/sprites";
import { type LessonRecord } from "../../game/lessonCatalog";

interface LessonBossViewProps {
  lesson: LessonRecord;
  bundle: AssetBundle | null;
  onFinishBoss: (score: number, total: number) => void;
  onReturnToDescent: () => void;
  reducedMotion?: boolean;
}

export function LessonBossView({
  lesson,
  bundle,
  onFinishBoss,
  onReturnToDescent,
  reducedMotion = false,
}: LessonBossViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [inReview, setInReview] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Filter valid questions
  const questions = lesson.questions.filter((q): q is NonNullable<typeof q> => q !== null);
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQIndex];

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bundle) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let prev = performance.now();

    const bossAnim = new SpriteAnimation(bundle, "goblin.idle.profile");

    const render = (time: number) => {
      const dt = Math.min((time - prev) / 1000, 0.1);
      prev = time;

      if (!reducedMotion) {
        bossAnim.update(dt);
      }

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;

      // Dark Hadal gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#0a2b49");
      grad.addColorStop(1, "#030c18");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw Goblin Shark sprite
      const bScale = speciesScale(bundle, "goblin", 130);
      drawFrame(ctx, bundle, bossAnim.frameName, Math.round(width * 0.5), Math.round(height * 0.55), bScale);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [bundle, reducedMotion]);

  const handleAnswer = (optionIdx: number) => {
    if (showFeedback) return;
    setSelectedOption(optionIdx);
    const isCorrect = optionIdx === currentQuestion.correct;
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
    }
    setShowFeedback(true);
  };

  const handleNextQuestion = () => {
    if (currentQIndex < totalQuestions - 1) {
      setCurrentQIndex((idx) => idx + 1);
      setSelectedOption(null);
      setShowFeedback(false);
    } else {
      // Completed all questions
      onFinishBoss(correctCount + (selectedOption === currentQuestion.correct ? 1 : 0), totalQuestions);
    }
  };

  return (
    <section className="lesson-boss-view" aria-labelledby="boss-title">
      <div className="eyebrow">FINAL CHALLENGE · MASTER REVIEW QUIZ</div>

      <div className="boss-hero panel">
        <div className="boss-copy">
          <h1 id="boss-title">Final Review Quiz</h1>
          <p>
            Test your knowledge across all topics to complete this study lesson!
          </p>

          <div className="boss-stats">
            <span>
              <b>09</b> TOTAL QUESTIONS
            </span>
            <span>
              <b>08</b> PASSING SCORE
            </span>
          </div>

          {!inReview ? (
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={onReturnToDescent}
              >
                ← Return to Study Map
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => setInReview(true)}
              >
                Start Final Quiz <span>→</span>
              </button>
            </div>
          ) : (
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              QUIZ IN PROGRESS: Question {currentQIndex + 1} of {totalQuestions}
            </span>
          )}
        </div>

        <div className="boss-visual">
          <canvas ref={canvasRef} width={420} height={340} className="pixel-scene" />
          <span>FINAL CHALLENGE GUARDIAN</span>
        </div>
      </div>

      {inReview && currentQuestion && (
        <div className="panel question-panel" style={{ marginTop: "18px" }}>
          <div className="question-meta">
            <span>{`QUESTION ${currentQIndex + 1} OF ${totalQuestions}`}</span>
            <span>SCORE: {correctCount} / {currentQIndex} CORRECT</span>
          </div>

          <h2 style={{ margin: "16px 0" }}>{currentQuestion.prompt}</h2>

          <div className="answer-list">
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isOptCorrect = idx === currentQuestion.correct;
              const btnClass = showFeedback
                ? isOptCorrect
                  ? "correct-answer-btn"
                  : isSelected
                  ? "wrong-answer-btn"
                  : ""
                : "";

              return (
                <button
                  key={opt}
                  type="button"
                  className={btnClass}
                  disabled={showFeedback}
                  onClick={() => handleAnswer(idx)}
                >
                  <kbd>{String.fromCharCode(65 + idx)}</kbd> {opt}
                </button>
              );
            })}
          </div>

          {showFeedback && (
            <div
              className={`feedback ${selectedOption === currentQuestion.correct ? "" : "incorrect"}`}
              style={{ marginTop: "16px" }}
            >
              {selectedOption === currentQuestion.correct ? (
                <>✓ <b>Correct!</b> Excellent work.</>
              ) : (
                <>
                  ✕ <b>Incorrect.</b> The correct answer was <b>{currentQuestion.answer}</b>.
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    {currentQuestion.explanation}
                  </p>
                </>
              )}
            </div>
          )}

          {showFeedback && (
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="primary-button"
                onClick={handleNextQuestion}
              >
                {currentQIndex < totalQuestions - 1 ? "Next Question →" : "View Final Results →"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
