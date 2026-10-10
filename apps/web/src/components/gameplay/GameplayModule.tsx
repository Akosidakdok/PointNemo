import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { type AssetBundle } from "../../game/sprites";
import { type LessonRecord, type DescentInstance, INITIAL_LESSON_CATALOG, lessonParts, bossPassScore } from "../../game/lessonCatalog";
import { ChooseSeaView } from "./ChooseSeaView";
import { DescentMapView } from "./DescentMapView";
import { EncounterCombatView } from "./EncounterCombatView";
import { LessonBossView } from "./LessonBossView";
import { GameplayResultsView } from "./GameplayResultsView";

export type GameplaySubscreen = "seas" | "descent" | "encounter" | "boss" | "results";

interface GameplayModuleProps {
  bundle: AssetBundle | null;
  customLessons?: LessonRecord[];
  initialSubscreen?: GameplaySubscreen;
  initialLessonId?: string;
  initialAction?: "resume" | "new";
  navKey?: number;
  enabled?: boolean;
  onNavigateScreen: (screen: "seas" | "descent" | "boss" | "results" | "library") => void;
  onUploadNewPdf: () => void;
  reducedMotion?: boolean;
  onUpdateActiveInstanceId?: (id: string | null, title?: string) => void;
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
  const parts = lessonParts(activeLesson);
  const part = parts[currentInstance.routeNode - 1] ?? [];
  const questionIndex = currentInstance.questionIndex ?? 0;
  const currentQuestion = part[questionIndex];

  useEffect(() => {
    if (!enabled) return;
    const requested = initialSubscreen;
    if (requested === "boss" && currentInstance.state !== "active") setSubscreen("results");
    else if (requested === "boss" && !currentInstance.bossReached)
      setSubscreen(currentInstance.activeEncounter ? "encounter" : "descent");
    else if (requested === "results" && currentInstance.state === "active")
      setSubscreen(currentInstance.activeEncounter ? "encounter" : "descent");
    else if (requested === "descent" && currentInstance.state !== "active") setSubscreen("results");
    else if (requested === "descent" && currentInstance.activeEncounter) setSubscreen("encounter");
    else setSubscreen(requested);
  }, [initialSubscreen, navKey, enabled]);

  useEffect(() => {
    onUpdateProgress?.(
      currentInstance.bossReached && currentInstance.state === "active",
      currentInstance.state !== "active"
    );
  }, [currentInstance.bossReached, currentInstance.state, onUpdateProgress]);

  const navigate = useCallback(
    (screen: "seas" | "descent" | "boss" | "results") => {
      setSubscreen(screen);
      onNavigateScreen(screen);
    },
    [onNavigateScreen]
  );

  const handleSelectLesson = useCallback(
    (lessonId: string, action: "resume" | "new" = "resume") => {
      const lesson = allLessons.find((entry) => entry.id === lessonId);
      if (!lesson || (lesson.isCustom && lessonParts(lesson).some((questions) => questions.length !== 3)))
        return;
      let id = activeInstanceByLesson.get(lessonId);
      if (action === "new" || !id || !instances.has(id)) {
        id = "PN-" + crypto.randomUUID().slice(0, 8);
        setInstances((previous) => new Map(previous).set(id!, makeInstance(id!, lesson)));
        setActiveInstanceByLesson((previous) => new Map(previous).set(lessonId, id!));
      }
      setActiveLessonId(lessonId);
      setActiveInstanceId(id!);
      onUpdateActiveInstanceId?.(id!, lesson.title);
      const instance = instances.get(id!);
      navigate(
        instance?.state && instance.state !== "active"
          ? "results"
          : instance?.bossReached
          ? "boss"
          : "descent"
      );
    },
    [activeInstanceByLesson, allLessons, instances, navigate, onUpdateActiveInstanceId]
  );

  // Synchronize when parent requests specific lesson selection or retake
  useEffect(() => {
    if (initialLessonId && initialSubscreen === "descent") {
      handleSelectLesson(initialLessonId, initialAction || "resume");
    }
  }, [initialLessonId, initialAction, navKey, initialSubscreen, handleSelectLesson]);

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

  const handleAnswerCombat = (option: number) => {
    setInstances((previous) => {
      const instance = previous.get(activeInstanceId)!;
      if (instance.routePartAnswered || !instance.activeEncounter || instance.state !== "active" || !currentQuestion)
        return previous;
      const correct = option === currentQuestion.correct;
      return new Map(previous).set(activeInstanceId, {
        ...instance,
        routePartAnswered: true,
        selectedOption: option,
        partCorrect: (instance.partCorrect ?? 0) + (correct ? 1 : 0),
        xp: (instance.xp ?? 0) + (correct ? 10 : 0),
        enemyHP: correct ? Math.max(0, instance.enemyHP - 50) : instance.enemyHP,
        playerHP: correct ? instance.playerHP : Math.max(0, instance.playerHP - 50),
      });
    });
  };

  const handleContinuePart = () => {
    if (!currentInstance.routePartAnswered) return;
    if (questionIndex < part.length - 1) {
      setInstances((previous) =>
        new Map(previous).set(activeInstanceId, {
          ...previous.get(activeInstanceId)!,
          questionIndex: questionIndex + 1,
          routePartAnswered: false,
          selectedOption: null,
        })
      );
      return;
    }
    const passed = (currentInstance.partCorrect ?? 0) >= Math.ceil((part.length * 2) / 3);
    setInstances((previous) => {
      const instance = previous.get(activeInstanceId)!;
      if (!instance.routePartAnswered || instance.routeNode !== currentInstance.routeNode)
        return previous;
      return new Map(previous).set(
        activeInstanceId,
        passed
          ? {
              ...instance,
              routeNode: instance.routeNode + 1,
              activeEncounter: false,
              routePartAnswered: false,
              selectedOption: null,
              questionIndex: 0,
              partCorrect: 0,
              clearedParts: (instance.clearedParts ?? 0) + 1,
              playerHP: 100,
              enemyHP: instance.routeNode === 3 ? 80 : 100,
            }
          : { ...instance, state: "failed", activeEncounter: false }
      );
    });
    navigate(passed ? "descent" : "results");
  };

  const handleBossAnswer = (option: number) => {
    setInstances((previous) => {
      const instance = previous.get(activeInstanceId)!;
      const index = instance.bossQuestionIndex ?? 0,
        answers = instance.bossAnswers ?? [];
      if (answers.length > index || instance.state !== "active") return previous;
      const question = parts.flat()[instance.bossOrder![index]];
      const correct = question && option === question.correct;
      return new Map(previous).set(activeInstanceId, {
        ...instance,
        bossAnswers: [...answers, option],
        bossScore: (instance.bossScore ?? 0) + (correct ? 1 : 0),
        xp: (instance.xp ?? 0) + (correct ? 10 : 0),
        playerHP: correct ? instance.playerHP : Math.max(0, instance.playerHP - 50),
        enemyHP: correct ? Math.max(0, instance.enemyHP - 10) : instance.enemyHP,
      });
    });
  };

  const handleContinueBoss = () => {
    const index = currentInstance.bossQuestionIndex ?? 0,
      total = parts.flat().length;
    if ((currentInstance.bossAnswers?.length ?? 0) <= index) return;
    if (index < total - 1)
      setInstances((previous) =>
        new Map(previous).set(activeInstanceId, {
          ...previous.get(activeInstanceId)!,
          bossQuestionIndex: index + 1,
        })
      );
    else {
      setInstances((previous) =>
        new Map(previous).set(activeInstanceId, {
          ...previous.get(activeInstanceId)!,
          state: (currentInstance.bossScore ?? 0) >= bossPassScore(total) ? "completed" : "failed",
        })
      );
      navigate("results");
    }
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
