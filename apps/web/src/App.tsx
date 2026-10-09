import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type DescentRun,
  type QuestionSet,
  type GenerationJob,
} from "@point-nemo/shared";
import {
  getAppStatus,
  uploadDocument,
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
  const [bossUnlocked, setBossUnlocked] = useState(false);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(1);

  const handleNavigate = useCallback(
    (screen: AppNavScreen) => {
      setCurrentScreen(screen);
      setNavKey((k) => k + 1);

      const stepMap: Record<AppNavScreen, number> = {
        library: 1,
        upload: 2,
        sonar: 2,
        seas: 3,
        descent: 4,
        boss: 4,
        results: 5,
        profile: 1,
      };
      const stepNum = stepMap[screen] || 1;
      setMaxUnlockedStep((prev) => Math.max(prev, stepNum));

      if (screen === "boss") {
        setBossUnlocked(true);
      }
      if (screen === "descent" && !activeInstanceId) {
        setActiveInstanceId("PN-001");
      }
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
    const saved = localStorage.getItem("point-nemo-theme");
    return (saved === "dark" || saved === "light") ? saved : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("point-nemo-theme", theme);
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
  const [isOllamaOffline, setIsOllamaOffline] = useState(false);

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
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    try {
      localStorage.removeItem("point_nemo_explorer");
    } catch {}
    setCurrentScreen("library");
  }, []);

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
  const handleStartProcessing = useCallback(
    async (file: File): Promise<QuestionSet | void> => {
      setExtractionStatus("active");
      setGenerationStatus("waiting");
      setValidationStatus("waiting");
      setProcessingError(null);
      setIsOllamaOffline(false);

      try {
        // 1. Upload to /api/documents
        const uploadResult = await uploadDocument(file);
        const jobId = uploadResult.jobId;

        // 2. Poll /api/jobs/:id with retry resilience
        let job: GenerationJob | null = null;
        let pollFails = 0;
        while (!job || job.state === "extracting" || job.state === "generating" || job.state === "validating") {
          try {
            job = await getGenerationJob(jobId);
            pollFails = 0;
          } catch (pollErr: any) {
            pollFails++;
            if (pollFails > 15) throw pollErr;
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }

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

          if (job.state === "ready" || job.state === "failed" || job.state === "cancelled") {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (job?.state === "failed") {
          const errMessage = job.errorMessage || job.errorCode || "Document processing failed.";
          throw new Error(errMessage);
        }

        if (job?.state === "ready" && job.questionSetId) {
          setExtractionStatus("complete");
          setGenerationStatus("complete");
          setValidationStatus("complete");

          // 3. Load question set
          const qSet = await getQuestionSet(job.questionSetId);
          await refreshLibraryData();
          return qSet;
        }
      } catch (err: any) {
        const isFetchFail = err?.message === "Failed to fetch" || err?.name === "TypeError";
        const msg = isFetchFail
          ? "Failed to connect to local backend (http://127.0.0.1:3000). Ensure backend is running with 'npm run dev'."
          : err?.message || "Document processing failed.";
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
        throw err;
      }
    },
    [extractionStatus, refreshLibraryData]
  );

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
        <AuthPage
          onAuthSuccess={handleAuthSuccess}
          onGuestAccess={handleGuestAccess}
          onOpenSettings={() => setIsSettingsOpen(true)}
          reducedMotion={reducedMotion}
          onToggleReducedMotion={() => setReducedMotion((m) => !m)}
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
          maxUnlockedStep={maxUnlockedStep}
        />

        {/* Active Screen Content */}
        <main className="playground-main">
          {/* Module 1: Local Library Hub */}
          {currentScreen === "library" && (
            <LibraryHubView
              questionSets={questionSets}
              activeInstanceId={activeInstanceId}
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
              onProcessingFinished={(newQSet) => {
                if (newQSet) {
                  setQuestionSets((prev) => [newQSet, ...prev]);
                }
                handleNavigate("seas");
              }}
              onCancel={() => handleNavigate("library")}
              realExtractionStatus={extractionStatus}
              realGenerationStatus={generationStatus}
              realValidationStatus={validationStatus}
              realError={processingError}
              isOllamaOffline={isOllamaOffline}
            />
          )}

          {/* Module 3: Gameplay Module (Choose Sea, WASD Map, Combat, Boss, Results) */}
          {(currentScreen === "seas" ||
            currentScreen === "descent" ||
            currentScreen === "boss" ||
            currentScreen === "results") && (
            <GameplayModule
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
                  : "results"
              }
              onNavigateScreen={(screen) => handleNavigate(screen)}
              onUploadNewPdf={() => handleNavigate("upload")}
              reducedMotion={reducedMotion}
              onUpdateActiveInstanceId={(id) => setActiveInstanceId(id)}
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
