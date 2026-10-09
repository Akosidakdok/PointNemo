import { OceanBackdrop } from "./OceanBackdrop";
import { ExplorerHero } from "./ExplorerHero";
import { ExpeditionStatus } from "./ExpeditionStatus";
import { AuthPanel } from "./AuthPanel";
import { type LocalExplorer } from "./auth.types";

export interface AuthPageProps {
  onContinue: (user: LocalExplorer) => void;
  onOpenSettings: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
}

export function AuthPage({
  onContinue,
  onOpenSettings,
  reducedMotion,
  onToggleReducedMotion,
}: AuthPageProps) {
  return (
    <div className="auth-page-root" role="main" aria-label="Point Nemo RPG Title Screen">
      {/* Dynamic Ocean Environment Backdrop */}
      <OceanBackdrop reducedMotion={reducedMotion} />

      {/* Floating System Controls (Top Right) */}
      <nav className="auth-top-controls" aria-label="System Settings">
        <button
          type="button"
          className="rpg-sys-btn"
          onClick={onToggleReducedMotion}
          aria-pressed={reducedMotion}
          title={reducedMotion ? "Enable animations" : "Reduce motion"}
        >
          <span aria-hidden="true">≋</span>
          <span>{reducedMotion ? "MOTION: OFF" : "MOTION: ON"}</span>
        </button>

        <button
          type="button"
          className="rpg-sys-btn"
          onClick={onOpenSettings}
          title="Open configuration"
          aria-label="Open settings"
        >
          <span aria-hidden="true">⚙</span>
          <span>SYS CONFIG</span>
        </button>
      </nav>

      {/* Vertically Centered Title & Auth Shell */}
      <div className="auth-shell">
        {/* Title Section (Levels 1 - 4) */}
        <header className="auth-title-section">
          <div className="rpg-title-badge">
            <span className="beacon-pixel-dot" aria-hidden="true" />
            <span>STUDY ON THIS LAPTOP · ONE LOCAL USER</span>
          </div>

          <h1 className="rpg-main-title">POINT NEMO</h1>

          <p className="rpg-main-tagline">
            Upload your notes. Build your knowledge. Defeat the lesson.
          </p>

          {/* Level 2: Front-Facing Explorer Character */}
          <ExplorerHero reducedMotion={reducedMotion} />

          {/* Level 4: Telemetry Strip */}
          <ExpeditionStatus />
        </header>

        {/* Authentication Terminal Panel (Levels 5 - 7) */}
        <section className="auth-panel-wrapper" aria-label="Expedition Identification Terminal">
          <AuthPanel onSuccess={onContinue} />
        </section>

        {/* Bottom Coordinates Flavor */}
        <footer className="auth-footer-coordinates" aria-hidden="true">
          <span>COORDINATES: 48°52.6′S 123°23.6′W</span>
          <span>·</span>
          <span>OCEANIC POLE OF INACCESSIBILITY</span>
        </footer>
      </div>
    </div>
  );
}
