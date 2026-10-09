import { useState, useEffect, useCallback } from "react";
import { getAppStatus, type AppStatus } from "./api";
import { loadAssetBundle, type AssetBundle } from "./game/sprites";
import { OceanCanvas } from "./game/OceanCanvas";
import { CompactHUD } from "./components/CompactHUD";
import { BottomControls } from "./components/BottomControls";
import { TitleScreen } from "./components/TitleScreen";
import { ExpeditionMap, mapNodes, type MapNode } from "./components/ExpeditionMap";
import { BattleEncounter } from "./components/BattleEncounter";
import { FieldGuideModal } from "./components/FieldGuideModal";
import { SettingsModal } from "./components/SettingsModal";
import { SonarPreloader } from "./components/ui/SonarPreloader";
import { GameModal } from "./components/ui/GameModal";

const initialStatus: AppStatus = {
  api: { available: false, message: "Checking local API…" },
  ai: { available: false, message: "Checking Ollama…" },
};

type ScreenView = "title" | "exploration";
type OverlayModal = "map" | "battle" | "guide" | "settings" | null;

export function App() {
  // Preloading & bundle state
  const [bundle, setBundle] = useState<AssetBundle | null>(null);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadTotal, setPreloadTotal] = useState(8);
  const [preloadError, setPreloadError] = useState<string | null>(null);

  // App & Gameplay state
  const [screen, setScreen] = useState<ScreenView>("title");
  const [overlay, setOverlay] = useState<OverlayModal>(null);
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [selectedNode, setSelectedNode] = useState<MapNode>(mapNodes[0]);
  const [depthMeters, setDepthMeters] = useState(4180);
  const [hullPercent] = useState(100);
  const [oxygenPercent] = useState(94);
  const [buoyDistance] = useState(240);
  const [sonarTriggerCount, setSonarTriggerCount] = useState(0);
  const [activeEncounter, setActiveEncounter] = useState<string | null>(null);

  // Preferences
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  // Load prepared runtime assets
  const loadAssets = useCallback(async () => {
    setPreloadError(null);
    setPreloadProgress(0);
    try {
      const loaded = await loadAssetBundle("/assets/runtime/manifest.json", (current, total) => {
        setPreloadProgress(current);
        setPreloadTotal(total);
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

  // Check API health status
  useEffect(() => {
    let active = true;
    void getAppStatus().then((nextStatus) => {
      if (active) setStatus(nextStatus);
    });
    return () => {
      active = false;
    };
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === "Space" && overlay === null && screen === "exploration") {
        e.preventDefault();
        setSonarTriggerCount((c) => c + 1);
      } else if (e.key === "Escape") {
        if (overlay !== null) {
          e.preventDefault();
          setOverlay(null);
        }
      } else if (e.key === "m" || e.key === "M") {
        if (overlay === "map") setOverlay(null);
        else if (overlay === null) setOverlay("map");
      } else if (e.key === "g" || e.key === "G") {
        if (overlay === "guide") setOverlay(null);
        else if (overlay === null) setOverlay("guide");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overlay, screen]);

  // Handlers
  const handleSonarPulse = useCallback(() => {
    setSonarTriggerCount((c) => c + 1);
  }, []);

  const handleQuickDive = useCallback(() => {
    setDepthMeters((d) => Math.min(10935, d + 250));
    setSonarTriggerCount((c) => c + 1);
  }, []);

  const handleEncounterTrigger = useCallback((creatureName: string) => {
    setActiveEncounter(creatureName);
  }, []);

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
    <main className="pointnemo-app" role="application" aria-label="Point Nemo Expedition Game">
      {/* 2D Interactive Ocean Viewport */}
      <div className="viewport-container" aria-hidden={screen === "title"}>
        <OceanCanvas
          bundle={bundle}
          depthMeters={depthMeters}
          onDepthChange={setDepthMeters}
          sonarTriggerCount={sonarTriggerCount}
          onEncounterTrigger={handleEncounterTrigger}
          paused={overlay !== null}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Screen 1: Title Screen */}
      {screen === "title" && (
        <TitleScreen
          onStartExpedition={() => setScreen("exploration")}
          onOpenMap={() => setOverlay("map")}
          onOpenGuide={() => setOverlay("guide")}
          onOpenSettings={() => setOverlay("settings")}
          isOnline={status.api.available || navigator.onLine}
        />
      )}

      {/* Screen 2: Exploration HUD & Controls */}
      {screen === "exploration" && (
        <>
          <CompactHUD
            depthMeters={depthMeters}
            hullPercent={hullPercent}
            oxygenPercent={oxygenPercent}
            buoyDistance={buoyDistance}
            onTriggerSonar={handleSonarPulse}
            onOpenMap={() => setOverlay("map")}
            onOpenGuide={() => setOverlay("guide")}
            onOpenSettings={() => setOverlay("settings")}
            onOpenBattle={() => setOverlay("battle")}
            isOnline={status.api.available || navigator.onLine}
            activeEncounter={activeEncounter}
          />

          <BottomControls
            onSonar={handleSonarPulse}
            onQuickDive={handleQuickDive}
            currentObjective={selectedNode.label}
          />
        </>
      )}

      {/* Modal 1: Tactical Route Map */}
      <GameModal
        isOpen={overlay === "map"}
        onClose={() => setOverlay(null)}
        title="HADAL DESCENT // TACTICAL ROUTE CHART"
        subtitle="NAVIGATION WAYPOINTS"
        maxWidth="720px"
      >
        <ExpeditionMap
          selectedId={selectedNode.id}
          onSelect={setSelectedNode}
          onLaunchEncounter={() => setOverlay("battle")}
          onClose={() => setOverlay(null)}
        />
      </GameModal>

      {/* Modal 2: Creature Encounter Turn-Battle */}
      <GameModal
        isOpen={overlay === "battle"}
        onClose={() => setOverlay(null)}
        title="ENGAGEMENT PROTOCOL // TURN BATTLE"
        subtitle="HADAL LIFEFORM"
        maxWidth="560px"
      >
        <BattleEncounter
          bundle={bundle}
          onClose={() => setOverlay(null)}
        />
      </GameModal>

      {/* Modal 3: Abyssal Field Guide */}
      <FieldGuideModal
        isOpen={overlay === "guide"}
        onClose={() => setOverlay(null)}
        bundle={bundle}
      />

      {/* Modal 4: Submersible Settings */}
      <SettingsModal
        isOpen={overlay === "settings"}
        onClose={() => setOverlay(null)}
        status={status}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={() => setReducedMotion((v) => !v)}
      />
    </main>
  );
}

export default App;
