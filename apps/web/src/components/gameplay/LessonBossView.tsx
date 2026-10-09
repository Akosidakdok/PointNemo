import { useEffect, useRef } from "react";
import {
  type AssetBundle,
  SpriteAnimation,
  frameDeltaSeconds,
  drawFrame,
  speciesScale,
} from "../../game/sprites";
import { type LessonRecord, type DescentInstance, lessonParts, bossPassScore } from "../../game/lessonCatalog";

interface LessonBossViewProps {
  lesson: LessonRecord;
  bundle: AssetBundle | null;
  instance: DescentInstance;
  onAnswer: (option: number) => void;
  onContinue: () => void;
  onStart: () => void;
  onReturnToDescent: () => void;
  reducedMotion?: boolean;
}

export function LessonBossView({
  lesson,
  bundle,
  instance,
  onAnswer,
  onContinue,
  onStart,
  onReturnToDescent,
  reducedMotion = false,
}: LessonBossViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const questionHeadingRef=useRef<HTMLHeadingElement | null>(null);
  const inReview=instance.bossStarted ?? false;
  const currentQIndex=instance.bossQuestionIndex ?? 0;
  const correctCount=instance.bossScore ?? 0;
  const selectedOption=instance.bossAnswers?.[currentQIndex] ?? null;
  const showFeedback=selectedOption!==null;
  const answerLocked=useRef(false);
  useEffect(()=>{answerLocked.current=showFeedback;},[currentQIndex,showFeedback]);
  useEffect(()=>{if(inReview)questionHeadingRef.current?.focus();},[currentQIndex,inReview]);

  // Filter valid questions
  const allQuestions = lessonParts(lesson).flat();
  const questions=(instance.bossOrder ?? allQuestions.map((_,index)=>index)).map((index)=>allQuestions[index]);
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQIndex];

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bundle) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let prev: number | null = null;

    const bossAnim = new SpriteAnimation(bundle, "goblin.idle.profile");

    const render = (time: number) => {
      const dt = frameDeltaSeconds(time, prev);
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
    if (showFeedback || answerLocked.current || !currentQuestion) return;
    answerLocked.current=true;
    onAnswer(optionIdx);
  };

  const handleNextQuestion = () => {
    if(showFeedback) onContinue();
  };

  return (
    <section className="lesson-boss-view" aria-labelledby="boss-title">
      <div className="eyebrow">MODULE 04 · LESSON BOSS REVIEW</div>

      <div className="boss-hero panel">
        <div className="boss-copy">
          <h1 id="boss-title">Apex Challenge</h1>
          <p>
            The Hadal Apex Goblin Shark guards the Point Nemo boundary. Review all
            lesson concepts to complete the expedition. Mixed-topic review: previously encountered questions.
          </p>

          <div className="boss-stats">
            <span>
              <b>{totalQuestions}</b> TARGET QUESTIONS
            </span>
            <span>
              <b>{bossPassScore(totalQuestions)}</b> REQUIRED TO PASS
            </span>
          </div>

          {!inReview ? (
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={onReturnToDescent}
              >
                ← Return to descent
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={onStart}
                disabled={!totalQuestions}
              >
                Engage Boss Review <span>→</span>
              </button>
            </div>
          ) : (
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              COMBAT REVIEW IN PROGRESS: {currentQIndex + 1} / {totalQuestions}
            </span>
          )}
        </div>

        <div className="boss-visual">
          <canvas ref={canvasRef} width={420} height={340} className="pixel-scene" />
          <span>GOBLIN SHARK · PROTOTYPE BOSS SPRITE</span>
        </div>
      </div>

      {inReview && currentQuestion && (
        <div className="panel question-panel" style={{ marginTop: "18px" }}>
          <div className="question-meta">
            <span>{`BOSS REVIEW QUESTION ${currentQIndex + 1} OF ${totalQuestions}`}</span>
            <span>SCORE: {correctCount} / {instance.bossAnswers?.length ?? 0} CORRECT</span>
            <span>Hull: {instance.playerHP} / 100 HP · Boss: {instance.enemyHP} / 80 HP · XP: {instance.xp ?? 0}</span>
          </div>

          <h2 ref={questionHeadingRef} tabIndex={-1} style={{ margin: "16px 0" }}>{currentQuestion.prompt}</h2>

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
                  key={idx}
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
                <>✓ <b>Direct hit!</b> Concept confirmed.</>
              ) : (
                <>
                  ✕ <b>Deflection!</b> Correct answer: <b>{currentQuestion.answer}</b>.
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    Review the explanation and source passage below.
                  </p>
                </>
              )}
              <div className="source-evidence"><small>SOURCE EXPLANATION</small><p>{currentQuestion.explanation}</p>
                {currentQuestion.supportingQuote && <blockquote>“{currentQuestion.supportingQuote}”</blockquote>}
                {currentQuestion.sourcePage && <p>PDF page {currentQuestion.sourcePage}</p>}
              </div>
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
