import { useEffect, useRef, useState } from "react";
import {
  type AssetBundle,
  SpriteAnimation,
  drawFrame,
  speciesScale,
} from "../../game/sprites";
import { type RouteQuestion, type DescentInstance } from "../../game/lessonCatalog";

interface EncounterCombatViewProps {
  instance: DescentInstance;
  question: RouteQuestion;
  topicName: string;
  partNumber: number;
  bundle: AssetBundle | null;
  onAnswer: (isCorrect: boolean) => void;
  onClearPart: () => void;
  reducedMotion?: boolean;
}

export function EncounterCombatView({
  instance,
  question,
  topicName,
  partNumber,
  bundle,
  onAnswer,
  onClearPart,
  reducedMotion = false,
}: EncounterCombatViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [answered, setAnswered] = useState(instance.routePartAnswered);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Species mapping per part
  const species = partNumber === 1 ? "barreleye" : partNumber === 2 ? "gulper" : "fringehead";

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bundle) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let prev = performance.now();

    const playerAnim = new SpriteAnimation(bundle, "explorer.swim.right");
    const creatureAnim = new SpriteAnimation(
      bundle,
      species === "barreleye" ? "barreleye.swim" : species === "gulper" ? "gulper.swim" : "fringehead.swim"
    );

    const render = (time: number) => {
      const dt = Math.min((time - prev) / 1000, 0.1);
      prev = time;

      if (!reducedMotion) {
        playerAnim.update(dt);
        creatureAnim.update(dt);
      }

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;

      // Underwater background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#082139");
      grad.addColorStop(1, "#030c18");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Grid depth sonar lines
      ctx.strokeStyle = "rgba(48, 214, 242, 0.12)";
      ctx.lineWidth = 1;
      for (let y = 16; y < height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Explorer on left
      const pScale = speciesScale(bundle, "explorer", 76);
      drawFrame(ctx, bundle, playerAnim.frameName, Math.round(width * 0.22), Math.round(height * 0.55), pScale);

      // Draw Creature on right
      const cScale = speciesScale(bundle, species, 88);
      drawFrame(ctx, bundle, creatureAnim.frameName, Math.round(width * 0.78), Math.round(height * 0.55), cScale);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [bundle, species, reducedMotion]);

  const handleSelectOption = (index: number) => {
    if (answered) return;
    setSelectedIdx(index);
    const correct = index === question.correct;
    setIsCorrect(correct);
    setAnswered(true);
    onAnswer(correct);
  };

  return (
    <section className="encounter-combat-view" aria-labelledby="combat-heading">
      {/* Health Tracks */}
      <div className="health-row">
        <div className="health-card">
          <div>
            <span>YOUR HEALTH (HP)</span>
            <b id="player-hp">{instance.playerHP} / 100 HP</b>
          </div>
          <div className="health-track">
            <i className="player-fill" style={{ width: `${instance.playerHP}%` }} />
          </div>
        </div>

        <div className="health-card">
          <div>
            <span>CHALLENGE (HP)</span>
            <b id="enemy-hp">{instance.enemyHP} / 100 HP</b>
          </div>
          <div className="health-track">
            <i className="enemy-fill" style={{ width: `${instance.enemyHP}%` }} />
          </div>
        </div>
      </div>

      <div className="panel combat-panel">
        <div className="combat-scene">
          <canvas ref={canvasRef} width={680} height={190} className="pixel-scene" />
        </div>

        <div className="question-panel">
          <div className="question-meta">
            <span>{`PRACTICE QUESTION · 0${partNumber} / 03`}</span>
            <span>{`TOPIC: ${topicName.toUpperCase()}`}</span>
          </div>

          <h2 id="combat-heading">{question.prompt}</h2>

          <div className="answer-list" role="group" aria-label="Multiple choice answer options">
            {question.options.map((opt, idx) => {
              const isSelected = selectedIdx === idx;
              const isOptionCorrect = idx === question.correct;
              const btnClass = answered
                ? isOptionCorrect
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
                  disabled={answered}
                  onClick={() => handleSelectOption(idx)}
                >
                  <kbd>{String.fromCharCode(65 + idx)}</kbd> {opt}
                </button>
              );
            })}
          </div>

          {answered && (
            <div
              className={`feedback ${isCorrect ? "" : "incorrect"}`}
              role="status"
              aria-live="polite"
            >
              {isCorrect ? (
                <>
                  ✓ <b>Correct!</b> Great job! +10 XP awarded.
                </>
              ) : (
                <>
                  ✕ <b>Not quite right.</b> The correct answer was{" "}
                  <b>{question.answer}</b>.
                  <div className="source-evidence">
                    <small>EXPLANATION</small>
                    <p>{question.explanation}</p>
                    {question.supportingQuote && (
                      <>
                        <small>QUOTE FROM YOUR NOTES</small>
                        <blockquote>“{question.supportingQuote}”</blockquote>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="question-footer">
            <span>
              Answer correctly to clear this challenge · +10 XP
            </span>
            <button
              type="button"
              className="primary-button"
              disabled={!answered}
              onClick={onClearPart}
            >
              {partNumber < 3 ? "Next Topic →" : "Proceed to Final Quiz →"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
