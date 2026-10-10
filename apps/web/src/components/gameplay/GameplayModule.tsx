import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { type AssetBundle } from "../../game/sprites";
import { type LessonRecord, type DescentInstance, INITIAL_LESSON_CATALOG, lessonParts } from "../../game/lessonCatalog";
import { answerPart, continuePart, answerBoss, continueBoss, resumeScreen, resolveGameplayScreen, type GameplaySubscreen } from "../../game/quizFlow";
import { ChooseSeaView } from "./ChooseSeaView";
import { DescentMapView } from "./DescentMapView";
import { EncounterCombatView } from "./EncounterCombatView";
import { LessonBossView } from "./LessonBossView";
import { GameplayResultsView } from "./GameplayResultsView";

export type { GameplaySubscreen } from "../../game/quizFlow";

interface GameplayModuleProps {
  bundle: AssetBundle | null;
  customLessons?: LessonRecord[];
  initialSubscreen?: GameplaySubscreen;
  initialLessonId?: string;
  initialAction?: "resume" | "new";
  lessonSelectionKey?: number;
  navKey?: number;
  enabled?: boolean;
  onNavigateScreen: (screen: "seas" | "descent" | "boss" | "results" | "library") => void;
  onUploadNewPdf: () => void;
  reducedMotion?: boolean;
  onUpdateActiveInstanceId?: (id: string | null, title?: string, lessonId?: string) => void;
  onUpdateProgress?: (bossUnlocked: boolean, resultsUnlocked: boolean) => void;
}

function makeInstance(id: string, lesson: LessonRecord): DescentInstance {
  const bossOrder = lessonParts(lesson).flat().map((_, index) => index);
  for (let i = bossOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bossOrder[i], bossOrder[j]] = [bossOrder[j], bossOrder[i]];
  }
  return {
    id,
    lessonId: lesson.id,
    routeNode: 1,
    routePartAnswered: false,
    activeEncounter: false,
    bossReached: false,
    player: { x: 0.5, y: 0.57, facing: "up" },
    playerHP: 100,
    enemyHP: 100,
    clearedParts: 0,
    bossScore: 0,
    questionIndex: 0,
    partCorrect: 0,
    selectedOption: null,
    xp: 0,
    state: "active",
    bossOrder,
    bossQuestionIndex: 0,
    bossAnswers: [],
    bossStarted: false,
  };
}

export function GameplayModule({
  bundle,
  customLessons = [],
  initialSubscreen = "seas",
  initialLessonId,
  initialAction = "resume",
  lessonSelectionKey = 0,
  navKey,
  enabled = true,
  onNavigateScreen,
  onUploadNewPdf,
  reducedMotion = false,
  onUpdateActiveInstanceId,
  onUpdateProgress,
}: GameplayModuleProps) {
  const allLessons = useMemo(
    () => [...customLessons, ...Object.values(INITIAL_LESSON_CATALOG)],
    [customLessons]
  );
  const [activeLessonId, setActiveLessonId] = useState("marine-biology");
  const [subscreen, setSubscreen] = useState<GameplaySubscreen>("seas");
  const [instances, setInstances] = useState(
    () => new Map([["PN-001", makeInstance("PN-001", INITIAL_LESSON_CATALOG["marine-biology"])]])
  );
  const [activeInstanceByLesson, setActiveInstanceByLesson] = useState(
    () => new Map([["marine-biology", "PN-001"]])
  );
  const [activeInstanceId, setActiveInstanceId] = useState("PN-001");
  const activeLesson = allLessons.find((lesson) => lesson.id === activeLessonId)!;
  const currentInstance = instances.get(activeInstanceId)!;
  const instanceRef = useRef(currentInstance);
  instanceRef.current = currentInstance;
  const navigationRef = useRef(onNavigateScreen);
  navigationRef.current = onNavigateScreen;
  const consumedSelectionKey = useRef<number | null>(null);
  const parts = lessonParts(activeLesson);
  const part = parts[currentInstance.routeNode - 1] ?? [];
  const questionIndex = currentInstance.questionIndex ?? 0;
  const currentQuestion = part[questionIndex];

  useEffect(() => {
    if (!enabled) return;
    // A pending lesson request will choose its own screen after selecting the run.
    if (initialSubscreen === "descent" && initialLessonId && consumedSelectionKey.current !== lessonSelectionKey) return;
    const resolved = resolveGameplayScreen(initialSubscreen, instanceRef.current);
    setSubscreen(resolved);
    const externalScreen = resolved === "encounter" ? "descent" : resolved;
    const requestedScreen = initialSubscreen === "encounter" ? "descent" : initialSubscreen;
    if (externalScreen !== requestedScreen) navigationRef.current(externalScreen);
  }, [initialSubscreen, navKey, enabled, initialLessonId, lessonSelectionKey]);

  useEffect(() => {
    onUpdateProgress?.(
      currentInstance.bossReached && currentInstance.state === "active",
      currentInstance.state !== "active"
    );
  }, [currentInstance.bossReached, currentInstance.state, onUpdateProgress]);

  const navigate = useCallback(
    (screen: GameplaySubscreen) => {
      setSubscreen(screen);
      onNavigateScreen(screen === "encounter" ? "descent" : screen);
    },
    [onNavigateScreen]
  );

  const handleSelectLesson = useCallback(
    (lessonId: string, action: "resume" | "new" = "resume") => {
      const lesson = allLessons.find((entry) => entry.id === lessonId);
      if (!lesson || (lesson.isCustom && (lessonParts(lesson).length !== 3 || lessonParts(lesson).some((questions) => questions.length !== 3))))
        return;
      let id = activeInstanceByLesson.get(lessonId);
      if (action === "new" || !id || !instances.has(id)) {
        id = "PN-" + crypto.randomUUID().slice(0, 8);
        setInstances((previous) => new Map(previous).set(id!, makeInstance(id!, lesson)));
        setActiveInstanceByLesson((previous) => new Map(previous).set(lessonId, id!));
      }
      setActiveLessonId(lessonId);
      setActiveInstanceId(id!);
      onUpdateActiveInstanceId?.(id!, lesson.title, lesson.id);
      const instance = instances.get(id!);
      navigate(instance ? resumeScreen(instance) : "descent");
    },
    [activeInstanceByLesson, allLessons, instances, navigate, onUpdateActiveInstanceId]
  );

  // Synchronize when parent requests specific lesson selection or retake
  useEffect(() => {
    if (!enabled || !initialLessonId || initialSubscreen !== "descent" || consumedSelectionKey.current === lessonSelectionKey) return;
    // A library selection is a single request, not a reaction to every position/answer update.
    consumedSelectionKey.current = lessonSelectionKey;
    handleSelectLesson(initialLessonId, initialAction);
  }, [enabled, initialLessonId, initialAction, lessonSelectionKey, initialSubscreen, handleSelectLesson]);

  const handleUpdatePlayer = useCallback(
    (x: number, y: number, facing: "up" | "down" | "left" | "right") => {
      setInstances((previous) => {
        const instance = previous.get(activeInstanceId);
        if (!instance || instance.state !== "active") return previous;
        return new Map(previous).set(activeInstanceId, { ...instance, player: { x, y, facing } });
      });
    },
    [activeInstanceId]
  );

  const handleReachTarget = useCallback(
    (node: number) => {
      setInstances((previous) => {
        const instance = previous.get(activeInstanceId);
        if (!instance) return previous;
        return new Map(previous).set(
          activeInstanceId,
          node === 4
            ? { ...instance, bossReached: true, activeEncounter: false }
            : {
                ...instance,
                routeNode: node,
                activeEncounter: true,
                questionIndex: 0,
                routePartAnswered: false,
                selectedOption: null,
              }
        );
      });
      if (node === 4) navigate("boss");
      else setSubscreen("encounter");
    },
    [activeInstanceId, navigate]
  );

  const updateQuiz = (transition: (instance: DescentInstance) => DescentInstance) => {
    setInstances((previous) => {
      const instance = previous.get(activeInstanceId);
      if (!instance) return previous;
      const next = transition(instance);
      return next === instance ? previous : new Map(previous).set(activeInstanceId, next);
    });
  };

  const handleAnswerCombat = (option: number) => {
    updateQuiz((instance) => answerPart(instance, activeLesson, currentInstance.routeNode, questionIndex, option));
  };

  const handleContinuePart = () => {
    const next = continuePart(currentInstance, activeLesson, currentInstance.routeNode, questionIndex);
    if (next === currentInstance) return;
    updateQuiz((instance) => continuePart(instance, activeLesson, currentInstance.routeNode, questionIndex));
    if (!next.activeEncounter) navigate(next.state === "failed" ? "results" : "descent");
  };

  const handleBossAnswer = (option: number) => {
    updateQuiz((instance) => answerBoss(instance, activeLesson, currentInstance.bossQuestionIndex ?? 0, option));
  };

  const handleContinueBoss = () => {
    const index = currentInstance.bossQuestionIndex ?? 0;
    const next = continueBoss(currentInstance, activeLesson, index);
    if (next === currentInstance) return;
    updateQuiz((instance) => continueBoss(instance, activeLesson, index));
    if (next.state !== "active") navigate("results");
  };

  if (!enabled) return null;
  return (
    <div className="gameplay-module-container">
      {!activeLesson.isCustom && (
        <p className="muted">
          Sample expedition · one question per part. Uploaded lessons contain three questions per topic.
        </p>
      )}
      {subscreen === "seas" && (
        <ChooseSeaView
          lessons={allLessons}
          activeInstancesByLesson={activeInstanceByLesson}
          onSelectLesson={handleSelectLesson}
          onUploadNewPdf={onUploadNewPdf}
        />
      )}
      {subscreen === "descent" && (
        <DescentMapView
          instance={currentInstance}
          lesson={activeLesson}
          bundle={bundle}
          onReachTarget={handleReachTarget}
          onUpdatePlayer={handleUpdatePlayer}
          reducedMotion={reducedMotion}
        />
      )}
      {subscreen === "encounter" && currentQuestion && (
        <EncounterCombatView
          key={activeInstanceId + ":" + currentInstance.routeNode + ":" + questionIndex}
          instance={currentInstance}
          question={currentQuestion}
          topicName={activeLesson.topics[currentInstance.routeNode]}
          partNumber={currentInstance.routeNode}
          bundle={bundle}
          questionNumber={questionIndex + 1}
          totalQuestions={part.length}
          onAnswer={handleAnswerCombat}
          onClearPart={handleContinuePart}
          reducedMotion={reducedMotion}
        />
      )}
      {subscreen === "boss" && currentInstance.bossReached && (
        <LessonBossView
          key={activeInstanceId}
          lesson={activeLesson}
          instance={currentInstance}
          bundle={bundle}
          onAnswer={handleBossAnswer}
          onContinue={handleContinueBoss}
          onStart={() =>
            setInstances((previous) =>
              new Map(previous).set(activeInstanceId, {
                ...previous.get(activeInstanceId)!,
                bossStarted: true,
              })
            )
          }
          onReturnToDescent={() => navigate("descent")}
          reducedMotion={reducedMotion}
        />
      )}
      {subscreen === "results" && currentInstance.state !== "active" && (
        <GameplayResultsView
          partsCleared={currentInstance.clearedParts ?? 0}
          bossScore={currentInstance.bossScore ?? 0}
          totalBossQuestions={parts.flat().length}
          earnedXP={currentInstance.xp ?? 0}
          completed={currentInstance.state === "completed"}
          onReturnToLibrary={() => onNavigateScreen("library")}
          onChooseSea={() => navigate("seas")}
          onRetryLesson={() => handleSelectLesson(activeLesson.id, "new")}
        />
      )}
    </div>
  );
}
