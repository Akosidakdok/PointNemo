import { GameButton } from "./ui/GameButton";

export interface TitleScreenProps {
  onStartExpedition: () => void;
  onOpenMap: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  isOnline: boolean;
}

export function TitleScreen({
  onStartExpedition,
  onOpenMap,
  onOpenGuide,
  onOpenSettings,
  isOnline,
}: TitleScreenProps) {
  return (
    <div className="title-screen-overlay" role="region" aria-label="Point Nemo title screen">
      <div className="title-screen-card pixel-panel">
        <div className="title-signal-header">
          <span className="signal-dot" aria-hidden="true" />
          <span className="signal-text">TELEMETRY LOCK · PACIFIC SECTOR 01</span>
          <span className={`signal-status ${isOnline ? "is-online" : "is-offline"}`}>
            {isOnline ? "SIGNAL ACTIVE" : "OFFLINE CACHE"}
          </span>
        </div>

        <div className="title-branding">
          <h1 className="title-main-logo">POINT NEMO</h1>
          <p className="title-subhead">
            THE OCEANIC POLE OF INACCESSIBILITY · HADAL DESCENT
          </p>
        </div>

        <div className="title-coordinates-strip" aria-label="Geographical coordinates">
          <span>LAT 48°52.6′S</span>
          <span>LON 123°23.6′W</span>
          <span>+2,688 KM TO SHORE</span>
        </div>

        <div className="title-actions-menu">
          <GameButton
            variant="primary"
            size="lg"
            onClick={onStartExpedition}
            className="title-primary-btn"
          >
            ▶ BEGIN EXPEDITION DIVE
          </GameButton>

          <div className="title-secondary-row">
            <GameButton variant="secondary" size="md" onClick={onOpenMap}>
              ⌖ ROUTE MAP
            </GameButton>
            <GameButton variant="secondary" size="md" onClick={onOpenGuide}>
              ◈ FIELD GUIDE
            </GameButton>
            <GameButton variant="secondary" size="md" onClick={onOpenSettings}>
              ⚙ SYSTEMS
            </GameButton>
          </div>
        </div>

        <div className="title-footer-note">
          <span>NAUTILUS-01 DEEP SUBMERSIBLE // PRESS START TO SUBMERGE</span>
        </div>
      </div>
    </div>
  );
}
