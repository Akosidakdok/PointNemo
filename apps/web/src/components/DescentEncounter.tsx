import { useState, useEffect, useRef } from "react";
import {
  type DescentRun, type QuestionSet, type DescentZone, type RunDetail,
  type CurrentSlot, type AnswerSubmitResponse,
} from "../api";
import { captureSlot, restoreLatestFeedback, type FeedbackView } from "../answerView";
import { type AssetBundle, speciesScale, SpriteAnimation } from "../game/sprites";
import { GameButton } from "./ui/GameButton";
import { SourceEvidence } from "./SourceEvidence";

export interface DescentEncounterProps {
  run: DescentRun;
  runDetail: RunDetail;
  questionSet: QuestionSet;
  bundle: AssetBundle | null;
  onAnswerSubmit: (slotId: string, selectedAnswer: number) => Promise<AnswerSubmitResponse>;
  onContinue: (run: RunDetail) => void;
  onReturnToLibrary: () => void;
  reducedMotion?: boolean;
}
const ZONE_METADATA = {
  surface: { name: "SURFACE ZONE", enemyName: "CLOWNFISH", depthLabel: "0–200 M", totalQuestions: 3, targetPass: 2 },
  twilight: { name: "TWILIGHT ZONE", enemyName: "ANGLERFISH", depthLabel: "200–1,000 M", totalQuestions: 3, targetPass: 2 },
  midnight: { name: "MIDNIGHT ZONE", enemyName: "GIANT SQUID", depthLabel: "1,000–4,000 M", totalQuestions: 3, targetPass: 2 },
  boss: { name: "POINT NEMO BOSS", enemyName: "MEGALODON", depthLabel: "10,935 M", totalQuestions: 9, targetPass: 8 },
};
const stageStart = { surface: 0, twilight: 3, midnight: 6, boss: 9 };
const optionLetters = ["A", "B", "C", "D"];

export function DescentEncounter({ run, runDetail, questionSet, bundle, onAnswerSubmit,
  onContinue, onReturnToLibrary, reducedMotion = false }: DescentEncounterProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackView | null>(() => restoreLatestFeedback(runDetail, questionSet));
  const [pendingRun, setPendingRun] = useState<RunDetail | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const capturedAnswer = useRef<{ slot: CurrentSlot; selectedOption: number } | null>(null);
  const submissionLock = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayedStage = feedback?.encounterType ?? runDetail.currentSlot?.encounterType;
  const zoneInfo = displayedStage ? ZONE_METADATA[displayedStage] : null;
  const currentQuestion = feedback?.question ?? runDetail.currentSlot?.question;
  const snapshot = pendingRun ?? runDetail;
  const questionNumber = displayedStage ? (feedback?.slotIndex ?? runDetail.currentSlotIndex) - stageStart[displayedStage] + 1 : 0;
  const stageAttempts = (snapshot.attempts ?? []).filter((attempt) => attempt.encounterType === displayedStage);
  const correctSoFar = stageAttempts.filter((attempt) => attempt.isCorrect).length;

  async function handleSubmit() {
    if (submissionLock.current || feedback || !runDetail.currentSlot) return;
    if (!capturedAnswer.current) {
      if (selectedOption === null) return;
      capturedAnswer.current = { slot: captureSlot(runDetail.currentSlot), selectedOption };
    }
    const captured = capturedAnswer.current;
    submissionLock.current = true; setIsSubmitting(true); setSubmissionError(null);
    try {
      const result = await onAnswerSubmit(captured.slot.id, captured.selectedOption);
      setFeedback({ slotId: captured.slot.id, slotIndex: captured.slot.slotIndex,
        encounterType: captured.slot.encounterType, question: captured.slot.question,
        selectedOptionIndex: captured.selectedOption, feedback: result.feedback });
      setPendingRun(result.run);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "The answer was not confirmed by the server.");
    } finally { submissionLock.current = false; setIsSubmitting(false); }
  }

  function handleContinue() {
    onContinue(pendingRun ?? runDetail);
    capturedAnswer.current = null;
    setFeedback(null); setPendingRun(null); setSelectedOption(null); setSubmissionError(null);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || isSubmitting) return;
      if (event.target instanceof HTMLElement && event.target.closest("button,input,textarea,select,summary")) return;
      if (feedback) {
        if (event.key === "Enter") { event.preventDefault(); handleContinue(); }
        return;
      }
      if (event.key === "Enter" && (selectedOption !== null || capturedAnswer.current)) {
        event.preventDefault(); void handleSubmit(); return;
      }
      if (capturedAnswer.current) return;
      const index = ["1", "2", "3", "4"].indexOf(event.key);
      const letter = optionLetters.indexOf(event.key.toUpperCase());
      if (index !== -1 || letter !== -1) { event.preventDefault(); setSelectedOption(index !== -1 ? index : letter); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedOption, feedback, isSubmitting, pendingRun, runDetail, onAnswerSubmit, onContinue]);

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

  if (!currentQuestion || !zoneInfo) return <div className="encounter-loading-card pixel-panel" role="alert">
    <p>The server did not provide an active question. Return to the library and reopen the saved run.</p>
    <GameButton onClick={onReturnToLibrary}>RETURN TO LIBRARY</GameButton>
  </div>;
  const activeFeedback = feedback?.feedback;
  return (
    <div className="descent-encounter-view" role="region" aria-label={`${zoneInfo.name} encounter`}>
      <header className="encounter-top-hud pixel-panel">
        <div className="hud-combatant-status"><div className="status-label-group"><span>SUBMERSIBLE HULL</span><b>{snapshot.playerHp}%</b></div>
          <div className="encounter-health-track" role="progressbar" aria-label="Hull integrity" aria-valuemin={0} aria-valuemax={100} aria-valuenow={snapshot.playerHp}><div className="encounter-health-fill fill-player" style={{ width: `${snapshot.playerHp}%` }} /></div>
        </div>
        <div className="hud-zone-badge"><span className="zone-name-title">{zoneInfo.name}</span><span className="zone-enemy-tag">{zoneInfo.enemyName}</span></div>
        <div className="hud-stats-group"><div className="hud-stat-pill">QUESTION: <b>{questionNumber} / {zoneInfo.totalQuestions}</b></div>
          <div className="hud-stat-pill">SCORE: <b>{correctSoFar} / {stageAttempts.length}</b></div><div className="hud-stat-pill">TARGET: <b>{zoneInfo.targetPass} / {zoneInfo.totalQuestions}</b></div>
          <div className="hud-stat-pill xp-pill">XP: <b>{snapshot.xp}</b> · COMBO: <b>{snapshot.combo}</b></div>
          <GameButton size="sm" disabled={isSubmitting} onClick={onReturnToLibrary}>SAVE & RETURN TO LIBRARY</GameButton>
        </div>
      </header>
      <div className="encounter-arena-wrap pixel-panel" aria-hidden="true"><canvas ref={canvasRef} width={640} height={130} className="encounter-canvas pixel-art" />
        <div className="arena-telemetry-overlay"><span>DEPTH: {zoneInfo.depthLabel}</span><span>{zoneInfo.enemyName}</span></div>
      </div>
      <main className="encounter-study-panel pixel-panel" aria-live="polite">
        {displayedStage === "boss" && <p className="correct-answer-callout">MIXED-TOPIC REVIEW: PREVIOUSLY ENCOUNTERED QUESTIONS · 8/9 TO PASS</p>}
        <p>AI-generated questions. Review the supporting source passages after answering.</p>
        <div className="study-panel-header"><span className="question-topic-badge">TOPIC: {currentQuestion.topicName}</span><span className="question-difficulty-tag">{currentQuestion.difficulty.toUpperCase()}</span></div>
        <h2 className="question-prompt-text">{currentQuestion.prompt}</h2>
        <div className="answers-choice-grid">{currentQuestion.options.map((option, index) => <button key={index} type="button"
          disabled={!!feedback || isSubmitting || capturedAnswer.current !== null} className={`answer-choice-btn ${(feedback?.selectedOptionIndex ?? capturedAnswer.current?.selectedOption ?? selectedOption) === index ? "is-selected" : ""}`}
          onClick={() => setSelectedOption(index)} aria-pressed={(feedback?.selectedOptionIndex ?? capturedAnswer.current?.selectedOption ?? selectedOption) === index}>
          <span className="choice-letter-badge">[{optionLetters[index]}]</span><span className="choice-text">{option}</span>
        </button>)}</div>
        {submissionError && <div className="upload-error-banner" role="alert"><p>ANSWER NOT CONFIRMED: {submissionError}</p>
          <p>Retry sends the same selected answer to the same question slot. You can also reopen the run from the library to read the server's saved state.</p></div>}
        {!activeFeedback ? <div className="encounter-submit-row">
          <GameButton variant="primary" size="lg" disabled={isSubmitting || (selectedOption === null && !capturedAnswer.current)} onClick={() => void handleSubmit()}>
            {isSubmitting ? "WAITING FOR SERVER…" : submissionError ? "RETRY SAME ANSWER" : "CONFIRM ANSWER"}
          </GameButton><span className="keyboard-hint">SHORTCUTS: 1–4 OR A–D · ENTER TO CONFIRM</span>
        </div> : <div className={`answer-feedback-panel ${activeFeedback.isCorrect ? "feedback-correct" : "feedback-incorrect"}`} role="status">
          <div className="feedback-result-title"><b>{activeFeedback.isCorrect ? `CORRECT · +${activeFeedback.xpAwarded} XP · ENEMY −${activeFeedback.enemyDamageTaken} HP` : `INCORRECT · HULL −${activeFeedback.playerDamageTaken} HP`}</b></div>
          <p className="correct-answer-callout">CORRECT ANSWER: <b>[{optionLetters[activeFeedback.correctAnswerIndex]}] {currentQuestion.options[activeFeedback.correctAnswerIndex]}</b></p>
          <div className="explanation-block"><span className="block-label">EXPLANATION</span><p>{activeFeedback.explanation}</p></div>
          <SourceEvidence evidence={activeFeedback.evidence} questionSet={questionSet} />
          <div className="feedback-action-row"><GameButton variant="primary" size="lg" onClick={handleContinue}>{pendingRun?.state && pendingRun.state !== "active" ? "VIEW RESULTS" : "CONTINUE DESCENT"}</GameButton></div>
        </div>}
      </main>
    </div>
  );
}
