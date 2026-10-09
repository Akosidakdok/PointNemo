import { GameButton } from "./ui/GameButton";

export interface CompactHUDProps {
  depthMeters: number;
  hullPercent: number;
  oxygenPercent: number;
  buoyDistance: number;
  onTriggerSonar: () => void;
  onOpenMap: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onOpenBattle: () => void;
  isOnline: boolean;
  activeEncounter?: string | null;
}

export function CompactHUD({
  depthMeters,
  hullPercent,
  oxygenPercent,
  buoyDistance,
  onTriggerSonar,
  onOpenMap,
  onOpenGuide,
  onOpenSettings,
  onOpenBattle,
  isOnline,
  activeEncounter,
}: CompactHUDProps) {
  return (
    <header className="compact-hud" aria-label="Explorer diving telemetry HUD">
      {/* Top Left: Explorer Telemetry Panel */}
      <div className="hud-panel hud-telemetry">
        <div className="hud-metric">
          <span className="metric-label">DEPTH</span>
          <span className="metric-value depth-glow">
            {depthMeters.toLocaleString()} <small>M</small>
          </span>
        </div>
        <div className="hud-metric">
          <span className="metric-label">HULL</span>
          <div className="metric-meter" role="progressbar" aria-label="Hull integrity" aria-valuenow={hullPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="meter-fill hull-fill" style={{ width: `${hullPercent}%` }} />
          </div>
          <span className="metric-val-sm">{hullPercent}%</span>
        </div>
        <div className="hud-metric">
          <span className="metric-label">O₂</span>
          <div className="metric-meter" role="progressbar" aria-label="Oxygen reserves" aria-valuenow={oxygenPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="meter-fill o2-fill" style={{ width: `${oxygenPercent}%` }} />
          </div>
          <span className="metric-val-sm">{oxygenPercent}%</span>
        </div>
      </div>

      {/* Top Center: Beacon Nav & Encounter Banner */}
      <div className="hud-center">
        <div className="beacon-indicator">
          <span className="beacon-dot" aria-hidden="true" />
          <span className="beacon-label">BUOY BEACON:</span>
          <span className="beacon-dist">{buoyDistance} M</span>
        </div>
        {activeEncounter && (
          <button
            type="button"
            className="encounter-alert-pill"
            onClick={onOpenBattle}
            aria-label={`Encounter nearby: ${activeEncounter}. Click to engage.`}
          >
            <span className="alert-ping" aria-hidden="true">!</span>
            <span className="alert-text">{activeEncounter.toUpperCase()} DETECTED — ENGAGE</span>
          </button>
        )}
      </div>

      {/* Top Right: System & Nav Controls */}
      <nav className="hud-panel hud-controls" aria-label="Expedition options">
        <GameButton
          variant="primary"
          size="sm"
          onClick={onTriggerSonar}
          aria-label="Quick sonar ping"
          title="Emit Sonar Ping"
        >
          ⌁ PING
        </GameButton>
        <GameButton
          variant="secondary"
          size="sm"
          onClick={onOpenMap}
          aria-label="Open expedition route map"
          title="Open Map"
        >
          ⌖ MAP
        </GameButton>
        <GameButton
          variant="secondary"
          size="sm"
          onClick={onOpenGuide}
          aria-label="Open abyssal field guide"
          title="Field Guide"
        >
          ◈ GUIDE
        </GameButton>
        <GameButton
          variant="secondary"
          size="sm"
          onClick={onOpenSettings}
          aria-label="Open submersible systems settings"
          title="Submersible Systems"
        >
          ⚙ SYS
        </GameButton>
        <div className={`status-badge ${isOnline ? "is-online" : "is-offline"}`} title={isOnline ? "Systems Online" : "Operating Offline"}>
          <span className="status-dot" />
          <span className="status-label">{isOnline ? "ONLINE" : "OFFLINE"}</span>
        </div>
      </nav>
    </header>
  );
}
