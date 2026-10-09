<<<<<<< HEAD
import { useState, useEffect, useCallback, useRef } from "react";
import {
  ApiRequestError, getAppStatus, getQuestionSet, createRun, getRun, submitRunAnswer,
  fetchLibrary, deleteDocument, cancelGenerationJob, toDescentRun,
  type AppStatus, type DescentRun, type QuestionSet, type RunDetail,
  type GenerationJob, type LibraryDocument, type AnswerSubmitResponse,
=======
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type DescentRun,
  type QuestionSet,
} from "@point-nemo/shared";
import {
  getAppStatus,
  uploadDocument,
  getGenerationJob,
  getQuestionSet,
  fetchRuns,
  type AppStatus,
>>>>>>> origin/main
} from "./api";
import { GenerationSession, GenerationFailureError, type ProcessingStage } from "./processing";
import { loadAssetBundle, type AssetBundle } from "./game/sprites";
<<<<<<< HEAD
import { OceanCanvas } from "./game/OceanCanvas";
import { LocalLibrary } from "./components/LocalLibrary";
import { UploadDialog } from "./components/UploadDialog";
import { SonarProcessing } from "./components/SonarProcessing";
import { DescentEncounter } from "./components/DescentEncounter";
import { ResultsScreen } from "./components/ResultsScreen";
import { SettingsModal } from "./components/SettingsModal";
import { SonarPreloader } from "./components/ui/SonarPreloader";
import { AuthPage } from "./components/auth/AuthPage";
import { type LocalExplorer } from "./components/auth/auth.types";
=======
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
import { LeaderboardView } from "./components/leaderboard/LeaderboardView";
>>>>>>> origin/main

const initialStatus: AppStatus = {
  api: { available: false, message: "Checking local API…" },
  ai: { available: false, message: "Checking Ollama…" },
};
<<<<<<< HEAD
type AppView = "library" | "processing" | "encounter" | "results";
const messageOf = (error: unknown) => error instanceof Error ? error.message : "The local request could not be completed.";
=======
>>>>>>> origin/main

export function App() {
  const [bundle, setBundle] = useState<AssetBundle | null>(null);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadTotal, setPreloadTotal] = useState(8);
  const [preloadError, setPreloadError] = useState<string | null>(null);
<<<<<<< HEAD
  const [view, setView] = useState<AppView>("library");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<DescentRun | null>(null);
  const [currentRunDetail, setCurrentRunDetail] = useState<RunDetail | null>(null);
  const [currentQuestionSet, setCurrentQuestionSet] = useState<QuestionSet | null>(null);
  const [processingFile, setProcessingFile] = useState<File | null>(null);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("uploading");
  const [processingJob, setProcessingJob] = useState<GenerationJob | null>(null);
=======

  // App Navigation Screen
  const [currentScreen, setCurrentScreen] = useState<AppNavScreen>("library");
  const [navKey, setNavKey] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>("PN-001");
  const [bossUnlocked, setBossUnlocked] = useState(false);

  const handleNavigate = useCallback(
    (screen: AppNavScreen) => {
      setCurrentScreen(screen);
      setNavKey((k) => k + 1);
      if (screen === "boss") {
        setBossUnlocked(true);
      }
      if (screen === "descent" && !activeInstanceId) {
        setActiveInstanceId("PN-001");
      }
    },
    [activeInstanceId]
  );

  // Theme State
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // App & Run Data from SQLite
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [, setRuns] = useState<DescentRun[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);

  // Sonar Processing Stage State for Real Document Upload
  const [extractionStatus, setExtractionStatus] = useState<"waiting" | "active" | "complete" | "failed">("waiting");
  const [generationStatus, setGenerationStatus] = useState<"waiting" | "active" | "complete" | "failed">("waiting");
  const [validationStatus, setValidationStatus] = useState<"waiting" | "active" | "complete" | "failed">("waiting");
>>>>>>> origin/main
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const sessionRef = useRef<GenerationSession | null>(null);
  const navigationVersion = useRef(0);
  const libraryVersion = useRef(0);
  const busyRef = useRef(false);
  const deletedDocuments = useRef(new Set<string>());
  const [currentUser, setCurrentUser] = useState<LocalExplorer | null>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("point_nemo_explorer") || "null");
      if (stored && typeof stored === "object" && "displayName" in stored && typeof stored.displayName === "string" && stored.displayName.trim()) {
        return { displayName: stored.displayName, remembered: true };
      }
    } catch { /* A display name is optional when browser storage is unavailable. */ }
    return null;
  });
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const handleExplorer = useCallback((user: LocalExplorer) => {
    setCurrentUser(user);
    try {
<<<<<<< HEAD
      if (user.remembered) localStorage.setItem("point_nemo_explorer", JSON.stringify(user));
      else localStorage.removeItem("point_nemo_explorer");
    } catch { /* Study records live in the server database. */ }
=======
      localStorage.removeItem("point_nemo_explorer");
    } catch {}
    setCurrentScreen("library");
>>>>>>> origin/main
  }, []);

  const loadAssets = useCallback(async () => {
    setPreloadError(null);
    setPreloadProgress(0);
    try {
      setBundle(await loadAssetBundle("/assets/runtime/manifest.json", (cur, total) => {
        setPreloadProgress(cur); setPreloadTotal(total);
      }));
    } catch (error) { setPreloadError(messageOf(error)); }
  }, []);
  useEffect(() => { void loadAssets(); }, [loadAssets]);

  const refreshLibraryData = useCallback(async () => {
<<<<<<< HEAD
    const version = ++libraryVersion.current;
    const [appStatus, library] = await Promise.allSettled([getAppStatus(), fetchLibrary()]);
    if (version !== libraryVersion.current) return;
    if (appStatus.status === "fulfilled") setStatus(appStatus.value);
    if (library.status === "fulfilled") {
      setDocuments(library.value.filter((document) => !deletedDocuments.current.has(document.id)));
      setLibraryError(null);
    } else { setLibraryError(messageOf(library.reason)); }
  }, []);
  useEffect(() => { void refreshLibraryData(); }, [refreshLibraryData]);
  useEffect(() => () => {
    navigationVersion.current += 1;
    libraryVersion.current += 1;
    const session = sessionRef.current;
    if (session) void session.cancel().catch(() => { /* Library exposes unconfirmed jobs on next load. */ });
=======
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
>>>>>>> origin/main
  }, []);

  function showRun(detail: RunDetail, questions: QuestionSet) {
    if (deletedDocuments.current.has(questions.documentId)) return;
    const run = toDescentRun(detail, questions);
    setCurrentRun(run); setCurrentRunDetail(detail); setCurrentQuestionSet(questions);
    setView(detail.state === "active" ? "encounter" : "results");
  }

  function beginAction(key: string): number | null {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(key); setActionError(null); setNotice(null);
    return ++navigationVersion.current;
  }
  function endAction() { busyRef.current = false; setBusy(null); }

  async function handleOpenRun(runId: string) {
    const version = beginAction(runId);
    if (version === null) return;
    try {
      const detail = await getRun(runId);
      const questions = await getQuestionSet(detail.questionSetId);
      if (version === navigationVersion.current) showRun(detail, questions);
    } catch (error) { setActionError(messageOf(error)); }
    finally { endAction(); }
  }

  async function handleUseSaved(questionSetId: string, retryRunId?: string) {
    const version = beginAction(retryRunId || questionSetId);
    if (version === null) return;
    try {
      const previous = retryRunId ? await getRun(retryRunId) : undefined;
      const questions = await getQuestionSet(previous?.questionSetId || questionSetId);
      if (!questions.compatible) throw new ApiRequestError("These saved questions are incompatible with the current local configuration. Upload the PDF to generate a fresh set.", "INCOMPATIBLE_QUESTION_SET", 409);
      const detail = await createRun(questions.id);
      if (version === navigationVersion.current) showRun(detail, questions);
      void refreshLibraryData();
    } catch (error) { setActionError(messageOf(error)); }
    finally { endAction(); }
  }

  async function handleStartProcessing(file: File) {
    if (busyRef.current || sessionRef.current) return;
    const session = new GenerationSession();
    sessionRef.current = session;
    const version = ++navigationVersion.current;
    setProcessingFile(file); setProcessingStage("uploading"); setProcessingJob(null);
    setProcessingError(null); setActionError(null); setNotice(null); setIsCancelling(false);
    setIsUploadOpen(false); setView("processing");
    try {
      const questions = await session.start(file, (job) => {
        if (sessionRef.current !== session || version !== navigationVersion.current) return;
        setProcessingJob(job);
        if (job.state === "extracting" || job.state === "generating" || job.state === "validating") setProcessingStage(job.state);
      });
      if (!questions || session.cancelRequested || sessionRef.current !== session || version !== navigationVersion.current) return;
      setProcessingStage("opening");
      const detail = await createRun(questions.id);
      if (session.cancelRequested || sessionRef.current !== session || version !== navigationVersion.current) return;
      showRun(detail, questions);
      sessionRef.current = null;
      setProcessingFile(null);
      void refreshLibraryData();
    } catch (error) {
      if (sessionRef.current !== session || version !== navigationVersion.current || session.cancelRequested) return;
      setProcessingError(messageOf(error));
      if (error instanceof GenerationFailureError) setProcessingJob(error.job);
      if (!session.jobId && error instanceof ApiRequestError && error.statusCode < 500) sessionRef.current = null;
      void refreshLibraryData();
    }
  }

  async function handleCancelProcessing() {
    const session = sessionRef.current;
    if (!session) { setView("library"); return; }
    if (isCancelling) return;
    setIsCancelling(true); setProcessingError(null);
    try {
      const job = await session.cancel(true);
      navigationVersion.current += 1;
      sessionRef.current = null;
      setProcessingFile(null);
      setView("library");
      setNotice(job?.state === "ready"
        ? "Generation had already completed. Its saved questions are available in the library."
        : job?.state === "failed" ? "The generation job had already failed. Its error is recorded in the library."
        : "Generation cancelled. Previously saved questions and runs remain available.");
      void refreshLibraryData();
    } catch (error) {
      setProcessingError(`Cancellation could not be confirmed: ${messageOf(error)} Refresh the library to check any active job.`);
    } finally { setIsCancelling(false); }
  }

  function handleLeaveProcessing() {
    navigationVersion.current += 1;
    const session = sessionRef.current;
    if (session) void session.cancel().catch((error: unknown) => setActionError(`Cancellation could not be confirmed: ${messageOf(error)}`));
    sessionRef.current = null;
    setProcessingFile(null);
    setView("library");
    void refreshLibraryData();
<<<<<<< HEAD
  }

  async function handleRetryProcessing() {
    if (!processingFile || isCancelling) return;
    if (sessionRef.current) {
      try { await sessionRef.current.cancel(true); }
      catch (error) { setProcessingError(`Stop the previous job before retrying: ${messageOf(error)}`); return; }
      sessionRef.current = null;
    }
    await handleStartProcessing(processingFile);
  }

  async function handleAnswerSubmit(slotId: string, selectedAnswer: number): Promise<AnswerSubmitResponse> {
    if (!currentRunDetail) throw new Error("Open a saved run before submitting an answer.");
    const result = await submitRunAnswer(currentRunDetail.id, slotId, selectedAnswer);
    void refreshLibraryData();
    return result;
  }

  async function handleDeleteDocument(documentId: string) {
    const version = beginAction(documentId);
    if (version === null) throw new Error("Wait for the current library action to finish.");
    libraryVersion.current += 1;
    try {
      await deleteDocument(documentId);
      deletedDocuments.current.add(documentId);
      if (sessionRef.current?.documentId === documentId) {
        sessionRef.current.documentDeleted(); sessionRef.current = null;
      }
      setDocuments((saved) => saved.filter((document) => document.id !== documentId));
      if (currentRun?.documentId === documentId) {
        setCurrentRun(null); setCurrentRunDetail(null); setCurrentQuestionSet(null); setView("library");
      }
      setNotice("Document, saved questions, jobs, and progress deleted from the local app database.");
      void refreshLibraryData();
    } finally { endAction(); }
  }

  async function handleCancelSavedJob(jobId: string) {
    const version = beginAction(jobId);
    if (version === null) return;
    try {
      const job = await cancelGenerationJob(jobId);
      setNotice(job.state === "ready" ? "The job had already completed. Saved questions remain available." : `Job status: ${job.state}.`);
      void refreshLibraryData();
    } catch (error) { setActionError(messageOf(error)); }
    finally { endAction(); }
  }

  if (!bundle) return <main className="pointnemo-app"><SonarPreloader progress={preloadProgress} total={preloadTotal} error={preloadError} onRetry={loadAssets} /></main>;
  if (!currentUser) return (
    <main className="pointnemo-app auth-gateway-app" aria-label="Point Nemo local explorer setup">
      <AuthPage onContinue={handleExplorer} onOpenSettings={() => setIsSettingsOpen(true)} reducedMotion={reducedMotion} onToggleReducedMotion={() => setReducedMotion((motion) => !motion)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} status={status} reducedMotion={reducedMotion} onToggleReducedMotion={() => setReducedMotion((motion) => !motion)} />
    </main>
  );

  return (
    <main className="pointnemo-app" aria-label="Point Nemo educational descent">
      <div className="viewport-container" aria-hidden="true">
        <OceanCanvas bundle={bundle} depthMeters={currentRun ? { surface: 100, twilight: 800, midnight: 3200, boss: 10935, results: 0 }[currentRun.stage] : 0} sonarTriggerCount={0} paused={view !== "encounter"} reducedMotion={reducedMotion} />
      </div>
      {actionError && <div className="upload-error-banner" role="alert">{actionError}</div>}
      {notice && <div className="pixel-panel" role="status">{notice}</div>}
      {view === "library" && <LocalLibrary documents={documents} error={libraryError} busy={busy}
        onRefresh={() => void refreshLibraryData()} onUploadClick={() => setIsUploadOpen(true)}
        onResumeRun={(id) => void handleOpenRun(id)} onViewResults={(id) => void handleOpenRun(id)}
        onTryAgain={(id) => void handleUseSaved("", id)} onUseSaved={(id) => void handleUseSaved(id)}
        onDeleteDocument={handleDeleteDocument} onCancelJob={(id) => void handleCancelSavedJob(id)}
        status={status} onOpenSettings={() => setIsSettingsOpen(true)} currentUser={currentUser}
        onChangeName={() => { setCurrentUser(null); try { localStorage.removeItem("point_nemo_explorer"); } catch { /* optional preference */ } }} />}
      {view === "processing" && <SonarProcessing filename={processingFile?.name || "Selected PDF"} stage={processingStage} job={processingJob}
        error={processingError} isCancelling={isCancelling} canRetry={!!processingFile && (!processingJob || ["failed", "cancelled"].includes(processingJob.state))}
        onCancel={() => void handleCancelProcessing()} onRetry={() => void handleRetryProcessing()}
        onReturnToLibrary={handleLeaveProcessing} onChooseAnotherPdf={() => { handleLeaveProcessing(); setIsUploadOpen(true); }} />}
      {view === "encounter" && currentRun && currentRunDetail && currentQuestionSet && <DescentEncounter key={currentRun.id}
        run={currentRun} runDetail={currentRunDetail} questionSet={currentQuestionSet} bundle={bundle}
        onAnswerSubmit={handleAnswerSubmit} onContinue={(detail) => showRun(detail, currentQuestionSet)}
        onReturnToLibrary={() => { setView("library"); void refreshLibraryData(); }} reducedMotion={reducedMotion} />}
      {view === "results" && currentRun && currentQuestionSet && <ResultsScreen run={currentRun} questionSet={currentQuestionSet} busy={busy !== null}
        onTryAgain={() => void handleUseSaved(currentQuestionSet.id, currentRun.id)}
        onReturnToLibrary={() => { setView("library"); void refreshLibraryData(); }} onStartNewPdf={() => { setView("library"); setIsUploadOpen(true); }} />}
      <UploadDialog isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onConfirmFile={(file) => void handleStartProcessing(file)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} status={status} reducedMotion={reducedMotion} onToggleReducedMotion={() => setReducedMotion((motion) => !motion)} />
    </main>
=======
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
          await refreshLibraryData();
          return qSet;
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
            />
          )}

          {/* Standalone Extra: Leaderboard */}
          {currentScreen === "leaderboard" && (
            <LeaderboardView currentUser={currentUser} />
          )}
        </main>

        <footer className="playground-footer">
          <span>POINT NEMO · OCEAN EXPEDITION</span>
          <span>LOCAL FIRST · OFFLINE PWA</span>
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
>>>>>>> origin/main
  );
}

export default App;
