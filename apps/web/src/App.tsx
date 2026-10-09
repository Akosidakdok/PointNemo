import { useState, useEffect, useCallback } from "react";
import {
  type DescentRun,
  type QuestionSet,
  type RunDetail,
} from "@point-nemo/shared";
import {
  getAppStatus,
  uploadDocument,
  getGenerationJob,
  getQuestionSet,
  createRun,
  getRun,
  submitRunAnswer,
  fetchRuns,
  tryAgainRun,
  deleteRun,
  toDescentRun,
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
import { AuthoritativeBattle } from "./components/AuthoritativeBattle";
import { BattleEncounter } from "./components/BattleEncounter";
import { DocumentIntake } from "./components/DocumentIntake";
import { ExpeditionMap, mapNodes, type MapNode } from "./components/ExpeditionMap";

const initialStatus: AppStatus = {
  api: { available: false, message: "Checking local API…" },
  ai: { available: false, message: "Checking Ollama…" },
};

type AppView = "library" | "processing" | "encounter" | "results" | "expedition";

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
  const [currentRunDetail, setCurrentRunDetail] = useState<RunDetail | null>(null);
  const [currentQuestionSet, setCurrentQuestionSet] = useState<QuestionSet | null>(null);

  // Classic Expedition Map state
  const [selectedNode, setSelectedNode] = useState<MapNode>(mapNodes[0]);

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

  // Handler: Start Sonar Processing for Uploaded File via Authoritative Backend
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
        // 1. Upload to /api/documents
        const uploadResult = await uploadDocument(file);
        const jobId = uploadResult.jobId;

        // 2. Poll /api/jobs/:id
        let job = await getGenerationJob(jobId);
        while (job.state === "extracting" || job.state === "generating" || job.state === "validating") {
          if (job.state === "extracting") {
            setExtractionStatus("active");
            setGenerationStatus("waiting");
            setValidationStatus("waiting");
          } else if (job.state === "generating") {
            setExtractionStatus("complete");
            setGenerationStatus("active");
            setValidationStatus("waiting");
          } else if (job.state === "validating") {
            setExtractionStatus("complete");
            setGenerationStatus("complete");
            setValidationStatus("active");
          }
          await new Promise((resolve) => setTimeout(resolve, 800));
          job = await getGenerationJob(jobId);
        }

        if (job.state === "failed") {
          const errMessage = job.errorCode || "Document processing failed.";
          throw new Error(errMessage);
        }

        if (job.state === "ready" && job.questionSetId) {
          setExtractionStatus("complete");
          setGenerationStatus("complete");
          setValidationStatus("complete");

          // 3. Load question set
          const qSet = await getQuestionSet(job.questionSetId);

          // 4. Create authoritative run (18 slots)
          const runDetail = await createRun(job.questionSetId);
          const descentRun = toDescentRun(runDetail, qSet, file.name);

          setCurrentRun(descentRun);
          setCurrentRunDetail(runDetail);
          setCurrentQuestionSet(qSet);

          await refreshLibraryData();

          setTimeout(() => {
            setView("encounter");
          }, 800);
        }
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

  // Handler: Start Run from Classic View
  const handleStartClassicRun = useCallback(
    async (questionSetId: string) => {
      try {
        const runDetail = await createRun(questionSetId);
        const qSet = await getQuestionSet(questionSetId);
        const descentRun = toDescentRun(runDetail, qSet);
        setCurrentRunDetail(runDetail);
        setCurrentRun(descentRun);
        setCurrentQuestionSet(qSet);
        localStorage.setItem("point_nemo_active_run_id", runDetail.id);
        const encounterNode = mapNodes.find((node) => node.id === "anglerfish");
        if (encounterNode) setSelectedNode(encounterNode);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not start expedition run.");
      }
    },
    []
  );

  // Handler: Resume Run
  const handleResumeRun = useCallback(
    async (runId: string) => {
      const run = runs.find((r) => r.id === runId);
      if (!run) return;
      const qSet = questionSets.find((qs) => qs.id === run.questionSetId);
      if (!qSet) return;

      try {
        const runDetail = await getRun(runId);
        setCurrentRunDetail(runDetail);
      } catch {
        // fallback
      }

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
        setCurrentRunDetail(response.runDetail);
        await refreshLibraryData();

        // Check if run transitioned to results
        if (response.run.stage === "results" || response.runDetail.state !== "active") {
          setTimeout(() => {
            setView("results");
          }, 1200);
        }
        return response.runDetail.latestFeedback;
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
        const runDetail = await getRun(result.run.id);
        setCurrentRunDetail(runDetail);
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
          setCurrentRunDetail(null);
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
    async (runId: string) => {
      const run = runs.find((r) => r.id === runId);
      if (!run) return;
      const qSet = questionSets.find((qs) => qs.id === run.questionSetId);
      if (!qSet) return;

      try {
        const runDetail = await getRun(runId);
        setCurrentRunDetail(runDetail);
      } catch {
        // fallback
      }

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
            if (processingFile) void handleStartProcessing(processingFile);
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
          runDetail={currentRunDetail ?? undefined}
          latestFeedback={currentRunDetail?.latestFeedback}
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

      {/* Screen 5: Optional Classic Expedition Map Dashboard */}
      {view === "expedition" && (
        <div className="app-shell" style={{ position: "relative", zIndex: 10, width: "100%", background: "rgba(6,20,38,0.92)", minHeight: "100vh" }}>
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true"><i /><i /></span>
              <span>POINT <b>NEMO</b></span>
            </div>
            <div className="topbar-center">
              <span className="live-dot" aria-hidden="true" />
              <span>CLASSIC EXPEDITION DASHBOARD</span>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="connection-pill"
                onClick={() => setView("library")}
                style={{ cursor: "pointer", background: "none" }}
              >
                ← RETURN TO RETRO VIEW
              </button>
            </div>
          </header>

          <section className="expedition-layout" aria-label="Expedition dashboard">
            <div className="map-column">
              <ExpeditionMap selectedId={selectedNode.id} onSelect={setSelectedNode} />
              <section className="selected-location" aria-live="polite">
                <div className="location-index">{String(mapNodes.findIndex((node) => node.id === selectedNode.id) + 1).padStart(2, "0")}</div>
                <div className="location-copy">
                  <p className="eyebrow">SELECTED WAYPOINT <span>· {selectedNode.short.toUpperCase()}</span></p>
                  <h3>{selectedNode.label}</h3>
                  <p>{selectedNode.detail}</p>
                </div>
                {(selectedNode.kind === "encounter" || currentRunDetail) && <span className="waypoint-open">ENCOUNTER OPEN <i>↗</i></span>}
              </section>
            </div>

            <aside className="side-column" aria-label="Expedition details">
              {currentRunDetail ? (
                <AuthoritativeBattle
                  run={currentRunDetail}
                  onRunUpdated={(updated) => {
                    setCurrentRunDetail(updated);
                    if (currentQuestionSet) {
                      setCurrentRun(toDescentRun(updated, currentQuestionSet));
                    }
                    if (updated.state === "completed" || updated.state === "failed") {
                      localStorage.removeItem("point_nemo_active_run_id");
                    }
                  }}
                  onNewRun={() => {
                    setCurrentRunDetail(null);
                    setCurrentRun(null);
                    localStorage.removeItem("point_nemo_active_run_id");
                  }}
                  onRetryQuestionSet={(questionSetId) => void handleStartClassicRun(questionSetId)}
                />
              ) : selectedNode.kind === "encounter" ? (
                <BattleEncounter />
              ) : (
                <section className="mission-card">
                  <div className="mission-header"><p className="eyebrow">CURRENT MISSION</p><span className="mission-number">01 — 04</span></div>
                  <h2>Pressure<br /><em>makes life.</em></h2>
                  <p className="mission-description">Meet the organisms that turn darkness, cold, and immense pressure into a way of life.</p>
                  <div className="mission-separator" />
                  <div className="mission-stat"><span>SUBMERSIBLE</span><b>NAUTILUS-01</b></div>
                  <div className="mission-stat"><span>DEPTH</span><b>10,935 <small>m</small></b></div>
                  <div className="mission-stat"><span>EST. DURATION</span><b>~ 12 <small>min</small></b></div>
                  <button className="mission-button" type="button" onClick={() => setSelectedNode(mapNodes.find((node) => node.id === "adaptation")!)}>
                    Open lesson briefing <span aria-hidden="true">↗</span>
                  </button>
                </section>
              )}

              <DocumentIntake onStartRun={handleStartClassicRun} activeRunId={currentRunDetail?.id} />

              <div className="ambient-note"><span>↳</span> The map is only the beginning. Every lesson opens a deeper route.</div>
            </aside>
          </section>
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onConfirmFile={(file) => void handleStartProcessing(file)}
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
