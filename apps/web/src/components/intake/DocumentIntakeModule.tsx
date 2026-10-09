import { useState, useRef, useCallback } from "react";
import { type QuestionSet, type GenerationJob } from "@point-nemo/shared";

interface DocumentIntakeModuleProps {
  onStartRealProcessing?: (file: File, reuseSaved?: boolean) => Promise<QuestionSet | void>;
  onRetryGeneration?: () => Promise<QuestionSet | void>;
  processingJob?: GenerationJob | null;
  modelName?: string;
  onProcessingFinished: (qSet?: QuestionSet) => void;
  onCancel: () => void;
  realExtractionStatus?: "waiting" | "active" | "complete" | "failed";
  realGenerationStatus?: "waiting" | "active" | "complete" | "failed";
  realValidationStatus?: "waiting" | "active" | "complete" | "failed";
  realError?: string | null;
  isOllamaOffline?: boolean;
}

const STAGES = [
  {
    title: "Read PDF",
    desc: "Finding the text your quiz will use.",
  },
  {
    title: "Create quiz",
    desc: "Writing nine questions from your PDF.",
  },
  {
    title: "Check quiz",
    desc: "Making sure the questions and answers match your PDF.",
  },
];

export function DocumentIntakeModule({
  onStartRealProcessing,
  onRetryGeneration,
  processingJob,
  modelName = "qwen2.5:3b",
  onProcessingFinished,
  onCancel,
  realExtractionStatus,
  realGenerationStatus,
  realValidationStatus,
  realError,
  isOllamaOffline,
}: DocumentIntakeModuleProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reuseSaved, setReuseSaved] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [simulatedStage, setSimulatedStage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setFileError("Please choose a valid PDF file. Point Nemo requires an English text-based PDF.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileError(null);

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setFileError("Please choose a valid PDF file.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleBeginCalibration = useCallback(async () => {
    if (!selectedFile || isStarting) return;
    setIsProcessing(true);
    setIsStarting(true);

    if (onStartRealProcessing) {
      try {
        const result = await onStartRealProcessing(selectedFile, reuseSaved);
        if (result) {
          onProcessingFinished(result);
        }
      } catch (err: any) {
        console.warn("Real processing returned error or handled via props:", err);
      } finally {
        setIsStarting(false);
      }
    }
  }, [selectedFile, onStartRealProcessing, onProcessingFinished, reuseSaved, isStarting]);

  const handleRetryGeneration = async () => {
    if (!onRetryGeneration || isStarting) return;
    setIsStarting(true);
    try { const result = await onRetryGeneration(); if (result) onProcessingFinished(result); }
    catch { /* Parent displays the API error. */ }
    finally { setIsStarting(false); }
  };

  const phaseLabels: Record<string, [string, string]> = {
    reading: ["Reading your PDF", "Finding the text your quiz will use."],
    selecting: ["Finding key ideas", "Picking useful facts and ideas for your questions."],
    creating: ["Writing your quiz", "Creating nine questions from your PDF."],
    checking: ["Checking your quiz", "Making sure the questions and answers match your PDF."],
    repairing: ["Improving some questions", "A few questions need work. I’m fixing them and will check the quiz again."],
  };
  const repairedQuestionCount = processingJob?.timings?.repairedQuestions;
  const phaseDisplay = processingJob?.phase === "repairing" && repairedQuestionCount !== undefined
    ? [`Fixing ${repairedQuestionCount} ${repairedQuestionCount === 1 ? "question" : "questions"}`, "I’ll check the quiz again when they’re fixed."]
    : processingJob?.phase ? phaseLabels[processingJob.phase] : undefined;
  const repairProgress = repairedQuestionCount === undefined
    ? "I’m fixing a few questions, then I’ll check the quiz again."
    : `Fixing ${repairedQuestionCount} ${repairedQuestionCount === 1 ? "question" : "questions"}. I’ll check the quiz again when they’re fixed.`;
  const wasInterrupted = processingJob?.errorCode === "INTERRUPTED_JOB";
  const normalizedRealError = realError?.toLowerCase() ?? "";
  const errorMessage = wasInterrupted
    ? onRetryGeneration
      ? "Processing stopped early. Your PDF text is saved, so you can try again."
      : "Processing stopped early. Choose your PDF again to try once more."
    : processingJob?.errorCode === "DUPLICATE_QUESTION"
    ? "Some questions tested the same idea. Try again for a fresh set."
    : processingJob?.errorCode === "SOURCE_EVIDENCE_INVALID"
    ? "Some answers didn’t match the text in your PDF. Try again."
    : processingJob?.errorCode === "INSUFFICIENT_SOURCE"
    ? "Your PDF may not include enough different facts for nine questions. Choose a longer or more detailed section."
    : processingJob?.errorCode === "INVALID_MODEL_OUTPUT"
    ? "Some questions or answer choices need fixing. Try again."
    : normalizedRealError.includes("insufficient_source") || normalizedRealError.includes("not support three topics")
    ? "Your PDF may not include enough different facts for nine questions. Choose a longer or more detailed section."
    : normalizedRealError.includes("duplicate_question") || normalizedRealError.includes("repeats question")
    ? "Some questions tested the same idea. Try again for a fresh set."
    : normalizedRealError.includes("answer_choices") || normalizedRealError.includes("short exact phrase")
    ? "Some questions or answers didn’t match your PDF. Try again."
    : realError
    ? "We couldn’t finish making your quiz. Try again."
    : undefined;

  const handleAdvanceSimulatedStage = () => {
    if (simulatedStage >= STAGES.length - 1) {
      onProcessingFinished();
      return;
    }
    setSimulatedStage((prev) => prev + 1);
  };

  // Determine stage display: prefer real statuses if active, else simulated
  const isReal = Boolean(onStartRealProcessing && realExtractionStatus);
  const activeStageIndex = isReal
    ? realValidationStatus === "active" || realValidationStatus === "complete" || realValidationStatus === "failed"
      ? 2
      : realGenerationStatus === "active" || realGenerationStatus === "complete" || realGenerationStatus === "failed"
      ? 1
      : 0
    : simulatedStage;

  return (
    <section className="document-intake-module" aria-labelledby="intake-title">
      {!isProcessing ? (
        <div className="intake-selection-view">
          <div className="eyebrow">MODULE 01 · DOCUMENT INTAKE</div>
          <div className="page-heading">
            <div>
              <h1 id="intake-title">Add a study PDF</h1>
              <p>Upload an English text-based PDF to generate your local 9-question ocean descent.</p>
            </div>
            <p className="model-info">
              Inference model: <b>{modelName} (Local Ollama)</b>
            </p>
          </div>

          <div className="panel upload-panel" style={{ maxWidth: "680px", margin: "0 auto" }}>
            <div className="panel-heading">
              <div>
                <h2>Document selection</h2>
                <p>No upper page or file-size limit · Min 300 characters extracted locally</p>
              </div>
            </div>

            <label
              className="dropzone"
              htmlFor="pdf-file-upload"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <span className="upload-icon" aria-hidden="true">
                ↑
              </span>
              <strong>{selectedFile ? selectedFile.name : "Choose a PDF file or drag it here"}</strong>
              <span>
                {selectedFile
                  ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MiB · Ready for sonar extraction`
                  : "English, text-based documents only. Password-required and image-only PDFs need an unlocked text copy."}
              </span>
              <span className="choose-button">
                {selectedFile ? "Replace file" : "Browse files"}
              </span>
            </label>

            <input
              id="pdf-file-upload"
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            {fileError && (
              <p className="file-status error-text" role="alert">
                ⚠ {fileError}
              </p>
            )}

            {selectedFile && !fileError && (
              <label className="saved-reuse-option">
                <input type="checkbox" checked={reuseSaved} onChange={(event) => setReuseSaved(event.target.checked)} />
                Use saved questions if this exact PDF has a compatible lesson. Uncheck to generate a fresh set.
              </label>
            )}

            {selectedFile && !fileError && (
              <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="secondary-button" onClick={onCancel}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleBeginCalibration}
                  disabled={isStarting}
                >
                  Start Sonar Processing <span>→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="intake-sonar-view">
          <div className="eyebrow">MODULE 02 · MAKING YOUR QUIZ</div>
          <div className="page-heading">
            <div>
              <h1 id="sonar-title">Making your quiz</h1>
              <p>We’re turning your PDF into nine questions.</p>
            </div>
          </div>

          <section className="panel sonar-panel">
            <div className="sonar-rings" aria-hidden="true">
              <i />
              <i />
              <i />
              <b>◉</b>
            </div>

            <p className="eyebrow center-eyebrow">
              STEP <span>{activeStageIndex + 1} OF {STAGES.length}</span>
            </p>

            <h2 id="sonar-state" aria-live="polite">{realError ? "Let’s try that again" : phaseDisplay?.[0] ?? STAGES[activeStageIndex].title}</h2>
            <p className="muted center" style={{ maxWidth: "440px", margin: "6px auto 0" }}>
              {realError ? "We hit a problem while making your quiz." : phaseDisplay?.[1] ?? STAGES[activeStageIndex].desc}
            </p>
            {processingJob && (
              <div className="sonar-progress-detail">
                <p>Time so far: {Math.floor((processingJob.elapsedTimeMs ?? 0) / 1000)} sec</p>
                {!realError && processingJob.phase === "creating" && processingJob.timings?.createdQuestions !== undefined && <p>Questions ready: {processingJob.timings.createdQuestions} of 9</p>}
                {processingJob.timings?.selectedPassages !== undefined && <p>
                  Reading {processingJob.timings.selectedPassages} text sections from {processingJob.timings.selectedPages} {processingJob.timings.selectedPages === 1 ? "page" : "pages"} of your PDF.
                </p>}
                {!realError && processingJob.phase === "repairing" && <p>{processingJob.timings?.repairedQuestionsCompleted !== undefined && repairedQuestionCount !== undefined
                  ? `Fixed ${processingJob.timings.repairedQuestionsCompleted} of ${repairedQuestionCount} questions. Checking them against your PDF.`
                  : repairProgress}</p>}
              </div>
            )}

            <ol className="stage-list" id="stage-list">
              {STAGES.map((stg, idx) => {
                const isCurrent = idx === activeStageIndex;
                const isDone = idx < activeStageIndex;
                return (
                  <li key={stg.title} className={isCurrent ? "current" : isDone ? "done" : ""}>
                    <span>{`0${idx + 1}`}</span> {stg.title.split(" ")[0]}
                  </li>
                );
              })}
            </ol>

            {realError && (
              <div
                style={{
                  color: "var(--danger)",
                  margin: "12px 0 18px",
                  padding: "10px",
                  border: "1px solid var(--danger)",
                  borderRadius: "8px",
                  background: "rgba(255, 72, 83, 0.1)",
                  fontSize: "12px",
                }}
                role="alert"
              >
                <b>What happened:</b> {errorMessage}
                {isOllamaOffline && (
                  <p style={{ margin: "6px 0 0", fontSize: "11px", color: "var(--text)" }}>
                    Check that the local question service is running, then try again.
                  </p>
                )}
                <div style={{ marginTop: "12px", display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    className="primary-button"
                    style={{ fontSize: "11px", padding: "6px 12px" }}
                    onClick={onRetryGeneration ? handleRetryGeneration : handleBeginCalibration}
                    disabled={isStarting}
                  >
                    {onRetryGeneration ? "Try again →" : "Choose PDF and try again →"}
                  </button>
                </div>
              </div>
            )}

            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setIsProcessing(false);
                  onCancel();
                }}
              >
                Cancel
              </button>

              {!isReal && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleAdvanceSimulatedStage}
                >
                  {simulatedStage === STAGES.length - 1 ? "Choose your sea →" : "Advance preview state →"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
