import { useState, useEffect, useCallback } from "react";
import {
  type DescentRun,
  type QuestionSet,
} from "@point-nemo/shared";
import {
  getAppStatus,
  extractDocument,
  generateQuestionSet,
  fetchRuns,
  submitRunAnswer,
  tryAgainRun,
  deleteRun,
  type AppStatus,
} from "./api";
import { loadAssetBundle, type AssetBundle } from "./game/sprites";
import { OceanCanvas } from "./game/OceanCanvas";
import { LocalLibrary } from "./components/LocalLibrary";
import { UploadDialog } from "./components/UploadDialog";
import { SonarProcessing, type SonarStageStatus } from "./components/SonarProcessing";
import { DescentEncounter } from "./components/DescentEncounter";
import { ResultsScreen } from "./components/ResultsScreen";
import { SettingsModal } from "./components/SettingsModal";
import { SonarPreloader } from "./components/ui/SonarPreloader";

const initialStatus: AppStatus = {
  api: { available: false, message: "Checking local API…" },
  ai: { available: false, message: "Checking Ollama…" },
};

type AppView = "library" | "processing" | "encounter" | "results";

export function App() {
  // Preloading & assets
  const [bundle, setBundle] = useState<AssetBundle | null>(null);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadTotal, setPreloadTotal] = useState(8);
  const [preloadError, setPreloadError] = useState<string | null>(null);

  // App Navigation
  const [view, setView] = useState<AppView>("library");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // App & Run Data
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [runs, setRuns] = useState<DescentRun[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [currentRun, setCurrentRun] = useState<DescentRun | null>(null);
  const [currentQuestionSet, setCurrentQuestionSet] = useState<QuestionSet | null>(null);

  // Sonar Processing Stage State
  const [processingFile, setProcessingFile] = useState<File | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<SonarStageStatus>("waiting");
  const [generationStatus, setGenerationStatus] = useState<SonarStageStatus>("waiting");
  const [validationStatus, setValidationStatus] = useState<SonarStageStatus>("waiting");
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isOllamaOffline, setIsOllamaOffline] = useState(false);

  // Preferences
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  // Load assets
  const loadAssets = useCallback(async () => {
    setPreloadError(null);
    setPreloadProgress(0);
    try {
      const loaded = await loadAssetBundle("/assets/runtime/manifest.json", (cur, tot) => {
        setPreloadProgress(cur);
        setPreloadTotal(tot);
      });
      setBundle(loaded);
    } catch (err: any) {
      console.error("Failed to load asset bundle:", err);
      setPreloadError(err?.message || "Failed to load sprite atlases");
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  // Load API status and saved runs on mount
  const refreshLibraryData = useCallback(async () => {
    try {
      const [appStat, libraryData] = await Promise.all([
        getAppStatus(),
        fetchRuns().catch(() => ({ runs: [], questionSets: [] })),
      ]);
      setStatus(appStat);
      setRuns(libraryData.runs);
      setQuestionSets(libraryData.questionSets);
    } catch (err) {
      console.warn("Failed to refresh library data:", err);
    }
  }, []);

  useEffect(() => {
    void refreshLibraryData();
  }, [refreshLibraryData]);

  // Determine active run (unfinished run)
  const activeRun = runs.find((r) => r.status === "active") || null;

  // Handler: Start Sonar Processing for Uploaded File
  const handleStartProcessing = useCallback(
    async (file: File) => {
      setProcessingFile(file);
      setIsUploadOpen(false);
      setView("processing");
      setExtractionStatus("active");
      setGenerationStatus("waiting");
      setValidationStatus("waiting");
      setProcessingError(null);
      setIsOllamaOffline(false);

      try {
        // Stage 1: Extraction
        const extractedDoc = await extractDocument(file);
        setExtractionStatus("complete");
        setGenerationStatus("active");

        // Stage 2 & 3: Generation & Strict Validation
        const result = await generateQuestionSet(extractedDoc);
        setGenerationStatus("complete");
        setValidationStatus("complete");

        // Set active run and question set
        setCurrentRun(result.run);
        setCurrentQuestionSet(result.questionSet);

        // Update library list
        await refreshLibraryData();

        // Short pause to show validation complete, then start Surface Zone
        setTimeout(() => {
          setView("encounter");
        }, 800);
      } catch (err: any) {
        const msg = err?.message || "Document processing failed.";
        console.error("Processing error:", err);
        setProcessingError(msg);

        if (extractionStatus === "active") {
          setExtractionStatus("failed");
        } else {
          setGenerationStatus("failed");
          setValidationStatus("failed");
        }

        if (msg.includes("Ollama") || msg.includes("local AI") || err?.code === "OLLAMA_UNAVAILABLE") {
          setIsOllamaOffline(true);
        }
      }
    },
    [extractionStatus, refreshLibraryData]
  );

  // Handler: Resume Run
  const handleResumeRun = useCallback(
    (runId: string) => {
      const run = runs.find((r) => r.id === runId);
      if (!run) return;
      const qSet = questionSets.find((qs) => qs.id === run.questionSetId);
      if (!qSet) return;

      setCurrentRun(run);
      setCurrentQuestionSet(qSet);

      if (run.stage === "results") {
        setView("results");
      } else {
        setView("encounter");
      }
    },
    [runs, questionSets]
  );

  // Handler: Submit Answer in Encounter
  const handleAnswerSubmit = useCallback(
    async (selectedAnswer: number) => {
      if (!currentRun) return;

      try {
        const response = await submitRunAnswer(currentRun.id, selectedAnswer);
        setCurrentRun(response.run);
        await refreshLibraryData();

        // Check if run transitioned to results
        if (response.run.stage === "results") {
          setTimeout(() => {
            setView("results");
          }, 1200);
        }
      } catch (err) {
        console.error("Failed to submit answer:", err);
      }
    },
    [currentRun, refreshLibraryData]
  );

  // Handler: Try Again (uses SAME question set)
  const handleTryAgain = useCallback(
    async (runId: string) => {
      try {
        const result = await tryAgainRun(runId);
        setCurrentRun(result.run);
        setCurrentQuestionSet(result.questionSet);
        await refreshLibraryData();
        setView("encounter");
      } catch (err) {
        console.error("Failed to restart run:", err);
      }
    },
    [refreshLibraryData]
  );

  // Handler: Delete Run
  const handleDeleteRun = useCallback(
    async (runId: string) => {
      try {
        await deleteRun(runId);
        await refreshLibraryData();
        if (currentRun?.id === runId) {
          setCurrentRun(null);
          setCurrentQuestionSet(null);
          setView("library");
        }
      } catch (err) {
        console.error("Failed to delete run:", err);
      }
    },
    [currentRun, refreshLibraryData]
  );

  // Handler: View Results of finished run
  const handleViewResults = useCallback(
    (runId: string) => {
      const run = runs.find((r) => r.id === runId);
      if (!run) return;
      const qSet = questionSets.find((qs) => qs.id === run.questionSetId);
      if (!qSet) return;

      setCurrentRun(run);
      setCurrentQuestionSet(qSet);
      setView("results");
    },
    [runs, questionSets]
  );

  // Preloading View
  if (!bundle) {
    return (
      <main className="pointnemo-app">
        <SonarPreloader
          progress={preloadProgress}
          total={preloadTotal}
          error={preloadError}
          onRetry={loadAssets}
        />
      </main>
    );
  }

  return (
    <main className="pointnemo-app" role="application" aria-label="Point Nemo Educational Descent">
      {/* 2D Interactive Ocean Viewport in Background */}
      <div className="viewport-container" aria-hidden="true">
        <OceanCanvas
          bundle={bundle}
          depthMeters={
            currentRun
              ? currentRun.stage === "surface"
                ? 100
                : currentRun.stage === "twilight"
                ? 800
                : currentRun.stage === "midnight"
                ? 3200
                : 10935
              : 0
          }
          sonarTriggerCount={0}
          paused={view !== "encounter"}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Screen 1: Local Library (Home) */}
      {view === "library" && (
        <LocalLibrary
          runs={runs}
          questionSets={questionSets}
          activeRun={activeRun}
          onUploadClick={() => setIsUploadOpen(true)}
          onResumeRun={handleResumeRun}
          onTryAgain={handleTryAgain}
          onViewResults={handleViewResults}
          onDeleteRun={handleDeleteRun}
          isOnline={status.api.available}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Screen 2: Sonar Processing */}
      {view === "processing" && (
        <SonarProcessing
          filename={processingFile?.name || "document.pdf"}
          extractionStatus={extractionStatus}
          generationStatus={generationStatus}
          validationStatus={validationStatus}
          error={processingError}
          isOllamaOffline={isOllamaOffline}
          onCancel={() => setView("library")}
          onRetry={() => {
            if (processingFile) handleStartProcessing(processingFile);
          }}
          onChooseAnotherPdf={() => {
            setView("library");
            setIsUploadOpen(true);
          }}
        />
      )}

      {/* Screen 3: Descent Encounter (Surface, Twilight, Midnight, Boss) */}
      {view === "encounter" && currentRun && currentQuestionSet && (
        <DescentEncounter
          run={currentRun}
          questionSet={currentQuestionSet}
          bundle={bundle}
          onAnswerSubmit={handleAnswerSubmit}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Screen 4: Results */}
      {view === "results" && currentRun && currentQuestionSet && (
        <ResultsScreen
          run={currentRun}
          questionSet={currentQuestionSet}
          onTryAgain={() => handleTryAgain(currentRun.id)}
          onReturnToLibrary={() => setView("library")}
          onStartNewPdf={() => {
            setView("library");
            setIsUploadOpen(true);
          }}
        />
      )}

      {/* Upload Dialog */}
      <UploadDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onConfirmFile={handleStartProcessing}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        status={status}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={() => setReducedMotion((m) => !m)}
      />
    </main>
  );
}

export default App;
