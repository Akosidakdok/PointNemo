import { useState, useCallback, useMemo, useEffect } from "react";
import { type AssetBundle } from "../../game/sprites";
import {
  type LessonRecord,
  type DescentInstance,
  INITIAL_LESSON_CATALOG,
} from "../../game/lessonCatalog";
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
  onNavigateScreen: (screen: any) => void;
  onUploadNewPdf: () => void;
  reducedMotion?: boolean;
  onUpdateActiveInstanceId?: (id: string | null) => void;
}

export function GameplayModule({
  bundle,
  customLessons = [],
  initialSubscreen = "seas",
  initialLessonId,
  initialAction = "resume",
  navKey,
  onNavigateScreen,
  onUploadNewPdf,
  reducedMotion = false,
  onUpdateActiveInstanceId,
}: GameplayModuleProps) {
  // Combine catalog lessons with custom uploaded lessons
  const allLessons = useMemo(() => {
    const list = Object.values(INITIAL_LESSON_CATALOG);
    return [...customLessons, ...list];
  }, [customLessons]);

  const [activeLessonId, setActiveLessonId] = useState<string>("marine-biology");
  const [subscreen, setSubscreen] = useState<GameplaySubscreen>(initialSubscreen);

  // Synchronize subscreen whenever parent navigation changes (e.g. from header tabs)
  useEffect(() => {
    if (initialSubscreen) {
      setSubscreen(initialSubscreen);
    }
  }, [initialSubscreen, navKey]);
  const [instances, setInstances] = useState<Map<string, DescentInstance>>(() => {
    const map = new Map<string, DescentInstance>();
    map.set("PN-001", {
      id: "PN-001",
      lessonId: "marine-biology",
      routeNode: 1,
      routePartAnswered: false,
      activeEncounter: false,
      bossReached: false,
      player: { x: 0.5, y: 0.57, facing: "up" },
      playerHP: 100,
      enemyHP: 100,
      clearedParts: 0,
      bossScore: 0,
    });
    return map;
  });

  const [activeInstanceByLesson, setActiveInstanceByLesson] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    map.set("marine-biology", "PN-001");
    return map;
  });

  const [activeInstanceId, setActiveInstanceId] = useState<string>("PN-001");

  // Keep parent in sync
  const updateInstanceId = useCallback(
    (id: string | null) => {
      setActiveInstanceId(id || "");
      if (onUpdateActiveInstanceId) onUpdateActiveInstanceId(id);
    },
    [onUpdateActiveInstanceId]
  );

  const activeLesson = allLessons.find((l) => l.id === activeLessonId) || allLessons[0];
  const currentInstance = instances.get(activeInstanceId) || instances.get("PN-001")!;

  const handleSelectLesson = useCallback(
    (lessonId: string, action: "resume" | "new") => {
      setActiveLessonId(lessonId);
      const existingInstanceId = activeInstanceByLesson.get(lessonId);

      if (action === "resume" && existingInstanceId && instances.has(existingInstanceId)) {
        updateInstanceId(existingInstanceId);
        setSubscreen("descent");
        onNavigateScreen("descent");
      } else {
        // Create new isolated instance
        const nextNum = instances.size + 1;
        const newId = `PN-${String(nextNum).padStart(3, "0")}`;
        const newInst: DescentInstance = {
          id: newId,
          lessonId,
          routeNode: 1,
          routePartAnswered: false,
          activeEncounter: false,
          bossReached: false,
          player: { x: 0.5, y: 0.57, facing: "up" },
          playerHP: 100,
          enemyHP: 100,
          clearedParts: 0,
          bossScore: 0,
        };

        setInstances((prev) => new Map(prev).set(newId, newInst));
        setActiveInstanceByLesson((prev) => new Map(prev).set(lessonId, newId));
        updateInstanceId(newId);
        setSubscreen("descent");
        onNavigateScreen("descent");
      }
    },
    [activeInstanceByLesson, instances, updateInstanceId, onNavigateScreen]
  );

  // Synchronize when parent requests specific lesson selection or retake
  useEffect(() => {
    if (initialLessonId && initialSubscreen === "descent") {
      handleSelectLesson(initialLessonId, initialAction || "resume");
    }
  }, [initialLessonId, initialAction, navKey, initialSubscreen]);

  const handleUpdatePlayer = useCallback(
    (x: number, y: number, facing: "up" | "down" | "left" | "right") => {
      setInstances((prev) => {
        const inst = prev.get(activeInstanceId);
        if (!inst) return prev;
        const updated = { ...inst, player: { x, y, facing } };
        return new Map(prev).set(activeInstanceId, updated);
      });
    },
    [activeInstanceId]
  );

  const handleReachTarget = useCallback(
    (nodeIndex: number) => {
      if (nodeIndex <= 3) {
        setInstances((prev) => {
          const inst = prev.get(activeInstanceId);
          if (!inst) return prev;
          return new Map(prev).set(activeInstanceId, {
            ...inst,
            activeEncounter: true,
            routePartAnswered: false,
          });
        });
        setSubscreen("encounter");
      } else {
        // Boss node
        setInstances((prev) => {
          const inst = prev.get(activeInstanceId);
          if (!inst) return prev;
          return new Map(prev).set(activeInstanceId, {
            ...inst,
            bossReached: true,
          });
        });
        setSubscreen("boss");
        onNavigateScreen("boss");
      }
    },
    [activeInstanceId, onNavigateScreen]
  );

  const handleAnswerCombat = useCallback(
    (isCorrect: boolean) => {
      setInstances((prev) => {
        const inst = prev.get(activeInstanceId);
        if (!inst) return prev;
        return new Map(prev).set(activeInstanceId, {
          ...inst,
          routePartAnswered: true,
          enemyHP: isCorrect ? Math.max(0, inst.enemyHP - 50) : inst.enemyHP,
          playerHP: isCorrect ? inst.playerHP : Math.max(20, inst.playerHP - 50),
        });
      });
    },
    [activeInstanceId]
  );

  const handleClearPart = useCallback(() => {
    setInstances((prev) => {
      const inst = prev.get(activeInstanceId);
      if (!inst) return prev;
      const nextNode = inst.routeNode + 1;
      return new Map(prev).set(activeInstanceId, {
        ...inst,
        routeNode: nextNode,
        activeEncounter: false,
        routePartAnswered: false,
        clearedParts: (inst.clearedParts || 0) + 1,
        playerHP: 100,
        enemyHP: 100,
      });
    });

    // Always return to the descent map so player swims to the next marker (including the final boss at node 4)
    setSubscreen("descent");
    onNavigateScreen("descent");
  }, [activeInstanceId, onNavigateScreen]);

  const handleFinishBoss = useCallback(
    (score: number) => {
      setInstances((prev) => {
        const inst = prev.get(activeInstanceId);
        if (!inst) return prev;
        return new Map(prev).set(activeInstanceId, {
          ...inst,
          bossScore: score,
        });
      });
      setSubscreen("results");
      onNavigateScreen("results");
    },
    [activeInstanceId, onNavigateScreen]
  );

  return (
    <div className="gameplay-module-container">
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

      {subscreen === "encounter" && (
        <EncounterCombatView
          instance={currentInstance}
          question={
            activeLesson.questions[currentInstance.routeNode] ||
            activeLesson.questions[1]!
          }
          topicName={activeLesson.topics[currentInstance.routeNode] || "Marine Life"}
          partNumber={currentInstance.routeNode}
          bundle={bundle}
          onAnswer={handleAnswerCombat}
          onClearPart={handleClearPart}
          reducedMotion={reducedMotion}
        />
      )}

      {subscreen === "boss" && (
        <LessonBossView
          lesson={activeLesson}
          bundle={bundle}
          onFinishBoss={handleFinishBoss}
          onReturnToDescent={() => {
            setSubscreen("descent");
            onNavigateScreen("descent");
          }}
          reducedMotion={reducedMotion}
        />
      )}

      {subscreen === "results" && (
        <GameplayResultsView
          partsCleared={currentInstance.clearedParts || 3}
          bossScore={currentInstance.bossScore || 8}
          totalBossQuestions={
            activeLesson.questions.filter((q) => q !== null).length || 9
          }
          earnedXP={170}
          onReturnToLibrary={() => onNavigateScreen("library")}
          onChooseSea={() => {
            setSubscreen("seas");
            onNavigateScreen("seas");
          }}
          onRetryLesson={() => handleSelectLesson(activeLesson.id, "new")}
        />
      )}
    </div>
  );
}
