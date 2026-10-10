import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  type DescentRun,
  type QuestionSet,
  type GenerationJob,
} from "@point-nemo/shared";
import {
  getAppStatus,
  ApiRequestError,
  uploadDocument,
  retryDocument,
  cancelGenerationJob,
  type ProcessingRequest,
  getGenerationJob,
  getQuestionSet,
  fetchRuns,
  type AppStatus,
} from "./api";
import { loadAssetBundle, type AssetBundle } from "./game/sprites";
import { questionSetToLessonRecord, type LessonRecord } from "./game/lessonCatalog";
import { SettingsModal } from "./components/SettingsModal";
import { SonarPreloader } from "./components/ui/SonarPreloader";
import { AuthPage } from "./components/auth/AuthPage";
import { type AuthenticatedUser } from "./components/auth/auth.types";
import { AppHeader, type AppNavScreen } from "./components/navigation/AppHeader";
import { LibraryHubView } from "./components/library/LibraryHubView";
import { DocumentIntakeModule } from "./components/intake/DocumentIntakeModule";
import { GameplayModule } from "./components/gameplay/GameplayModule";
import { ProfileView } from "./components/profile/ProfileView";
import { OceanAmbientBackground } from "./components/ambient/OceanAmbientBackground";

const initialStatus: AppStatus = {
  api: { available: false, message: "Checking local API…" },
  ai: { available: false, message: "Checking Ollama…" },
};

export function App() {
  // Preloading & assets
  const [bundle, setBundle] = useState<AssetBundle | null>(null);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadTotal, setPreloadTotal] = useState(8);
  const [preloadError, setPreloadError] = useState<string | null>(null);

  // App Navigation Screen
  const [currentScreen, setCurrentScreen] = useState<AppNavScreen>("library");
  const [navKey, setNavKey] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>("PN-001");
  const [activeLessonTitle,setActiveLessonTitle]=useState("Introduction to Marine Biology (sample)");
  const [bossUnlocked, setBossUnlocked] = useState(false);
  const [resultsUnlocked, setResultsUnlocked] = useState(false);
  const [maxUnlockedStep,setMaxUnlockedStep]=useState(1);
  const handleUpdateProgress = useCallback((boss: boolean, results: boolean)=>{
    setBossUnlocked(boss);setResultsUnlocked(results);
  },[]);

  const handleNavigate = useCallback(
    (screen: AppNavScreen) => {
      const steps: Record<AppNavScreen,number>={library:1,upload:2,sonar:2,seas:3,descent:4,boss:4,results:5,profile:1};
      setMaxUnlockedStep((previous)=>Math.max(previous,steps[screen]));
      setCurrentScreen(screen);
      setNavKey((k) => k + 1);
    },
    [activeInstanceId]
  );

  // Selected Lesson State from Library Hub
  const [selectedLessonId, setSelectedLessonId] = useState<string>("marine-biology");
  const [selectedLessonAction, setSelectedLessonAction] = useState<"resume" | "new">("resume");

  const handleSelectLessonFromLibrary = useCallback(
    (lessonId: string, action: "resume" | "new") => {
      setSelectedLessonId(lessonId);
      setSelectedLessonAction(action);
      handleNavigate("descent");
    },
    [handleNavigate]
  );

  // Theme State (Default to Light Mode)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("point-nemo-theme-v2");
    return saved === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("point-nemo-theme-v2", theme);
  }, [theme]);

  // App & Run Data from SQLite
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [, setRuns] = useState<DescentRun[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);

  // Sonar Processing Stage State for Real Document Upload
  const [extractionStatus, setExtractionStatus] = useState<"waiting" | "active" | "complete" | "failed">("waiting");
  const [generationStatus, setGenerationStatus] = useState<"waiting" | "active" | "complete" | "failed">("waiting");
  const [validationStatus, setValidationStatus] = useState<"waiting" | "active" | "complete" | "failed">("waiting");
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingErrorCode, setProcessingErrorCode] = useState<string | undefined>();
  const [isOllamaOffline, setIsOllamaOffline] = useState(false);
  const [processingJob, setProcessingJob] = useState<GenerationJob | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const processingSession = useRef<{ controller: AbortController; jobId?: string } | null>(null);

  const cancelProcessing = useCallback(() => {
    const session = processingSession.current;
    session?.controller.abort();
    if (session?.jobId) void cancelGenerationJob(session.jobId).then((job) => {
      if (processingSession.current === null) setProcessingJob(job);
    }).catch((error) => {
      setProcessingError(`Could not confirm cancellation: ${error.message}. Check the local API.`);
    });
    processingSession.current = null;
  }, []);

  useEffect(() => () => cancelProcessing(), [cancelProcessing]);

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(() => {
    try {
      const stored = localStorage.getItem("point_nemo_explorer");
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const handleAuthSuccess = useCallback((user: AuthenticatedUser) => {
    setCurrentUser(user);
    setCurrentScreen("library");
    if (user.remembered) {
      try {
        localStorage.setItem("point_nemo_explorer", JSON.stringify(user));
      } catch {}
    }
  }, []);

  const handleGuestAccess = useCallback(() => {
    setCurrentUser({
      displayName: "Guest Explorer",
      email: "guest@pointnemo.local",
      remembered: false,
    });
    setCurrentScreen("library");
  }, []);

  const handleLogout = useCallback(() => {
    cancelProcessing();
    setCurrentUser(null);
    try {
      localStorage.removeItem("point_nemo_explorer");
    } catch {}
    setCurrentScreen("library");
  }, [cancelProcessing]);

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
        getAppStatus().catch(() => initialStatus),
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

  // Handler: Start Sonar Processing for Uploaded File via Authoritative Backend
  const processDocument = useCallback(
    async (start: (signal: AbortSignal) => Promise<ProcessingRequest>): Promise<QuestionSet | void> => {
      cancelProcessing();
      const session: { controller: AbortController; jobId?: string } = { controller: new AbortController() };
      processingSession.current = session;
      setExtractionStatus("active");
      setGenerationStatus("waiting");
      setValidationStatus("waiting");
      setProcessingError(null);
      setProcessingErrorCode(undefined);
      setIsOllamaOffline(false);
      setSavedNotice(null);
      let processingStage: "extracting" | "generating" | "validating" = "extracting";

      try {
        // 1. Upload to /api/documents
        const uploadResult = await start(session.controller.signal);
        setProcessingJob(null);
        const jobId = uploadResult.jobId;
        session.jobId = jobId;
        if (session.controller.signal.aborted) {
          if (!uploadResult.reused) await cancelGenerationJob(jobId);
          return;
        }
        if (uploadResult.reused) setSavedNotice(`Saved questions · Created ${new Date(uploadResult.savedAt!).toLocaleString()}`);

        // 2. Poll /api/jobs/:id with retry resilience
        let job: GenerationJob | null = null;
        let pollFails = 0;
        while (!job || job.state === "extracting" || job.state === "generating" || job.state === "validating") {
          session.controller.signal.throwIfAborted();
          try {
            job = await getGenerationJob(jobId);
            pollFails = 0;
          } catch (pollErr: any) {
            pollFails++;
            if (pollFails > 15) throw pollErr;
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }

          session.controller.signal.throwIfAborted();
          setProcessingJob(job);
          if (job.state === "extracting") {
            processingStage = "extracting";
            setExtractionStatus("active");
            setGenerationStatus("waiting");
            setValidationStatus("waiting");
          } else if (job.state === "generating") {
            processingStage = "generating";
            setExtractionStatus("complete");
            setGenerationStatus("active");
            setValidationStatus("waiting");
          } else if (job.state === "validating") {
            processingStage = "validating";
            setExtractionStatus("complete");
            setGenerationStatus("complete");
            setValidationStatus("active");
          }

          if (job.state === "ready" || job.state === "failed" || job.state === "cancelled") {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (job?.state === "failed") {
          processingStage = job.errorStage ?? processingStage;
          const errMessage = job.errorMessage || job.errorCode || "Document processing failed.";
          throw new ApiRequestError(errMessage, job.errorCode);
        }
        if (job?.state === "cancelled") throw new Error("Processing was cancelled. Select the PDF again to retry.");

        if (job?.state === "ready" && job.questionSetId) {
          setExtractionStatus("complete");
          setGenerationStatus("complete");
          setValidationStatus("complete");

          // 3. Load question set
          const qSet = await getQuestionSet(job.questionSetId);
          session.controller.signal.throwIfAborted();
          await refreshLibraryData();
          session.controller.signal.throwIfAborted();
          return qSet;
        }
      } catch (err: any) {
        if (session.controller.signal.aborted) return;
        const isFetchFail = err?.message === "Failed to fetch" || err?.name === "TypeError";
        const msg = isFetchFail
          ? "Failed to connect to local backend (http://127.0.0.1:3000). Ensure backend is running with 'npm run dev'."
          : err?.message || "Document processing failed.";
        console.error("Processing error:", err);
        setProcessingError(msg);
        setProcessingErrorCode(isFetchFail ? "NETWORK_ERROR" : err?.code);

        setExtractionStatus(processingStage === "extracting" ? "failed" : "complete");
        setGenerationStatus(processingStage === "generating" ? "failed" : processingStage === "validating" ? "complete" : "waiting");
        setValidationStatus(processingStage === "validating" ? "failed" : "waiting");

        if (msg.includes("Ollama") || msg.includes("local AI") || err?.code === "OLLAMA_UNAVAILABLE") {
          setIsOllamaOffline(true);
        }
        throw err;
      } finally {
        if (processingSession.current === session) processingSession.current = null;
      }
    },
    [cancelProcessing, refreshLibraryData]
  );

  const handleStartProcessing = useCallback((file: File, reuseSaved = false) => {
    setProcessingJob(null);
    // Keep the start response readable after Cancel so its job ID can be cancelled.
    return processDocument(() => uploadDocument(file, reuseSaved));
  }, [processDocument]);
  const handleRetryProcessing = useCallback(() => {
    if (!processingJob?.canRetry) return Promise.resolve();
    return processDocument(() => retryDocument(processingJob.documentId));
  }, [processingJob, processDocument]);

  // Convert real SQLite questionSets into playable LessonRecords
  const customLessonRecords = useMemo<LessonRecord[]>(() => {
    return questionSets.map((qs) => questionSetToLessonRecord(qs));
  }, [questionSets]);

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

  // RPG Title & Authentication Gateway (Before Login)
  if (!currentUser) {
    return (
      <main
        className="pointnemo-app auth-gateway-app"
        role="application"
        aria-label="Point Nemo Authentication Gateway"
      >
        {/* Full-Screen Ambient Ocean (Diver, Marine Life & Floating Bubbles Swimming Across Whole Landing Background) */}
        <OceanAmbientBackground
          bundle={bundle}
          reducedMotion={reducedMotion}
          theme={theme}
        />

        <AuthPage
          onAuthSuccess={handleAuthSuccess}
          onGuestAccess={handleGuestAccess}
          onOpenSettings={() => setIsSettingsOpen(true)}
          reducedMotion={reducedMotion}
          onToggleReducedMotion={() => setReducedMotion((m) => !m)}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
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

  // Main Integrated Post-Login Application Shell
  return (
    <div
      className="playground-shell"
      data-reduced-motion={reducedMotion ? "true" : undefined}
      role="application"
      aria-label="Point Nemo Educational Descent"
    >
      {/* Full-Screen Ambient Ocean (Diver, Marine Life & Floating Bubbles Swimming Across Whole Background) */}
      <OceanAmbientBackground
        bundle={bundle}
        reducedMotion={reducedMotion}
        theme={theme}
      />

      <div className="app-frame">
        {/* Top Header Navigation */}
        <AppHeader
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenSettings={() => setIsSettingsOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          activeInstanceId={activeInstanceId}
          bossUnlocked={bossUnlocked}
          resultsUnlocked={resultsUnlocked}
          maxUnlockedStep={maxUnlockedStep}
        />

        {/* Active Screen Content */}
        <main className="playground-main">
          {savedNotice && <p className="muted" role="status">{savedNotice}</p>}
          {/* Module 1: Local Library Hub */}
          {currentScreen === "library" && (
            <LibraryHubView
              questionSets={questionSets}
              activeInstanceId={activeInstanceId}
              activeLessonTitle={activeLessonTitle}
              onOpenUpload={() => handleNavigate("upload")}
              onGoToSeas={() => handleNavigate("seas")}
              onSelectLesson={handleSelectLessonFromLibrary}
              bundle={bundle}
              reducedMotion={reducedMotion}
            />
          )}

          {/* Module 2: Document Intake & Sonar Processing */}
          {(currentScreen === "upload" || currentScreen === "sonar") && (
            <DocumentIntakeModule
              onStartRealProcessing={handleStartProcessing}
              onRetryGeneration={processingJob?.canRetry ? handleRetryProcessing : undefined}
              processingJob={processingJob}
              modelName={status.ai.model}
              onProcessingFinished={(newQSet) => {
                if (newQSet) {
                  setQuestionSets((prev) => [newQSet, ...prev.filter((set) => set.id !== newQSet.id)]);
                }
                handleNavigate("seas");
              }}
              onCancel={() => { cancelProcessing(); handleNavigate("library"); }}
              realExtractionStatus={extractionStatus}
              realGenerationStatus={generationStatus}
              realValidationStatus={validationStatus}
              realError={processingError}
              realErrorCode={processingErrorCode}
              isOllamaOffline={isOllamaOffline}
            />
          )}

          {/* Module 3: Gameplay Module (Choose Sea, WASD Map, Combat, Boss, Results) */}
          {["seas", "descent", "boss", "results"].includes(currentScreen) && (
            <GameplayModule
              enabled={true}
              bundle={bundle}
              customLessons={customLessonRecords}
              navKey={navKey}
              initialLessonId={selectedLessonId}
              initialAction={selectedLessonAction}
              initialSubscreen={
                currentScreen === "seas"
                  ? "seas"
                  : currentScreen === "descent"
                  ? "descent"
                  : currentScreen === "boss"
                  ? "boss"
                  : currentScreen === "results" ? "results" : "seas"
              }
              onNavigateScreen={(screen) => handleNavigate(screen)}
              onUploadNewPdf={() => handleNavigate("upload")}
              reducedMotion={reducedMotion}
              onUpdateActiveInstanceId={(id,title) => {setActiveInstanceId(id);if(title)setActiveLessonTitle(title);}}
              onUpdateProgress={handleUpdateProgress}
            />
          )}

          {/* Standalone Extra: Diver Profile */}
          {currentScreen === "profile" && (
            <ProfileView
              currentUser={currentUser}
              bundle={bundle}
              reducedMotion={reducedMotion}
              onBack={() => handleNavigate("library")}
            />
          )}

        </main>

        <footer className="playground-footer">
          <span>POINT NEMO · STUDY ADVENTURE</span>
          <span>PRIVATE &amp; OFFLINE · RUNS ON YOUR DEVICE</span>
        </footer>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        status={status}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={() => setReducedMotion((m) => !m)}
      />
    </div>
  );
}

export default App;
