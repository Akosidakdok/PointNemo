import { GameModal } from "./ui/GameModal";
import { GameButton } from "./ui/GameButton";
import type { AppStatus } from "../api";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: AppStatus;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  status,
  reducedMotion,
  onToggleReducedMotion,
}: SettingsModalProps) {
  const isOnline = navigator.onLine;

  return (
    <GameModal
      isOpen={isOpen}
      onClose={onClose}
      title="SUBMERSIBLE SYSTEMS & CONFIGURATION"
      subtitle="MAINTENANCE CONSOLE // VERSION 1.0.0"
      maxWidth="600px"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <GameButton variant="primary" size="md" onClick={onClose}>
            CLOSE CONSOLE
          </GameButton>
        </div>
      }
    >
      <div className="settings-sections">
        {/* Navigation & Controls Section */}
        <section className="settings-block" aria-labelledby="controls-title">
          <h3 id="controls-title" className="settings-block-title">NAVIGATION CONTROLS</h3>
          <ul className="controls-guide-list">
            <li>
              <span>SWIM / MANEUVER</span>
              <kbd>ARROW KEYS</kbd> / <kbd>W A S D</kbd> or <span className="kbd-soft">TAP OCEAN</span>
            </li>
            <li>
              <span>EMIT SONAR PULSE</span>
              <kbd>SPACEBAR</kbd>
            </li>
            <li>
              <span>RESOLVE TURN / ATTACK</span>
              <kbd>ENTER</kbd>
            </li>
            <li>
              <span>CLOSE ACTIVE OVERLAY</span>
              <kbd>ESC</kbd>
            </li>
          </ul>
        </section>

        {/* Accessibility & Display Preferences */}
        <section className="settings-block" aria-labelledby="accessibility-title">
          <h3 id="accessibility-title" className="settings-block-title">ENVIRONMENT SENSORS & ACCESSIBILITY</h3>
          <div className="setting-toggle-row">
            <div>
              <p className="setting-label">REDUCED MOTION MODE</p>
              <p className="setting-desc">Minimizes water drift, sonar sweeps, and camera movement.</p>
            </div>
            <GameButton
              variant={reducedMotion ? "primary" : "secondary"}
              size="sm"
              onClick={onToggleReducedMotion}
              aria-pressed={reducedMotion}
            >
              {reducedMotion ? "ENABLED" : "DISABLED"}
            </GameButton>
          </div>
        </section>

        {/* Submersible Offline & Telemetry Diagnostics */}
        <section className="settings-block" aria-labelledby="diagnostics-title">
          <h3 id="diagnostics-title" className="settings-block-title">LOCAL SYSTEM STATUS</h3>
          <div className="diagnostics-grid">
            <div className="diag-item">
              <span className="diag-label">STUDY STORAGE</span>
              <span className="diag-value">LOCAL SERVER DATABASE · ONE SHARED USER</span>
            </div>
            <div className="diag-item">
              <span className="diag-label">NETWORK TELEMETRY</span>
              <span className={`diag-value ${isOnline ? "is-ok" : "is-warn"}`}>
                {isOnline ? "BROWSER REPORTS NETWORK AVAILABLE" : "BROWSER REPORTS NETWORK UNAVAILABLE"}
              </span>
            </div>
            <div className="diag-item">
              <span className="diag-label">LOCAL API SERVER</span>
              <span className={`diag-value ${status.api.available ? "is-ok" : "is-warn"}`}>
                {status.api.message}
              </span>
            </div>
            <div className="diag-item">
              <span className="diag-label">LOCAL INFERENCE</span>
              <span className={`diag-value ${status.ai.available ? "is-ok" : "is-muted"}`}>
                {status.ai.message}
              </span>
            </div>
          </div>
        </section>
      </div>
    </GameModal>
  );
}
