import { OceanAuthScene } from "./OceanAuthScene";
import { AuthPanel } from "./AuthPanel";
import { type LocalExplorer } from "./auth.types";
import { type AssetBundle } from "../../game/sprites";

export interface AuthLayoutProps {
  bundle: AssetBundle | null;
  onContinue: (user: LocalExplorer) => void;
  onOpenSettings: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
}

export function AuthLayout({
  bundle,
  onContinue,
  onOpenSettings,
  reducedMotion,
  onToggleReducedMotion,
}: AuthLayoutProps) {
  return (
    <div className="auth-layout-root">
      <header className="auth-top-header">
        <div className="auth-header-brand">
          <span className="auth-brand-beacon" aria-hidden="true" />
          <div className="auth-brand-lockup">
            <span className="auth-brand-title">POINT NEMO</span>
            <span className="auth-brand-tag">EXPEDITION GATEWAY</span>
          </div>
        </div>

        <div className="auth-header-actions">
          <div className="auth-depth-readout" aria-label="Current depth: 0 meters">
            <span>DEPTH</span>
            <strong>0000 M</strong>
          </div>

          <button
            type="button"
            className="auth-utility-btn"
            onClick={onToggleReducedMotion}
            aria-pressed={reducedMotion}
            aria-label={reducedMotion ? "Enable ambient motion" : "Reduce motion"}
            title={reducedMotion ? "Enable ambient animations" : "Reduce motion"}
          >
            <span className="auth-utility-mark" aria-hidden="true">M</span>
            <span>{reducedMotion ? "MOTION OFF" : "MOTION ON"}</span>
          </button>

          <button
            type="button"
            className="auth-utility-btn"
            onClick={onOpenSettings}
            title="Open system configuration"
            aria-label="Open settings"
          >
            <span className="auth-utility-mark" aria-hidden="true">CFG</span>
            <span>CONFIG</span>
          </button>
        </div>
      </header>

      <div className="auth-split-container">
        <section className="auth-scene-column" aria-label="Point Nemo surface approach">
          <OceanAuthScene bundle={bundle} reducedMotion={reducedMotion} />
        </section>

        <section className="auth-panel-column" aria-label="Explorer identification">
          <AuthPanel onSuccess={onContinue} />
        </section>
      </div>

      <footer className="auth-telemetry-footer">
        <div className="footer-left">
          <span className="footer-status-dot" aria-hidden="true" />
          <span>SONAR ONLINE</span>
          <span className="footer-sep">/</span>
          <span>POINT NEMO ROUTE ACQUIRED</span>
        </div>
        <div className="footer-right">
          <span>LOCAL EXPEDITION SYSTEM</span>
          <span className="footer-sep">·</span>
          <span>PN-01</span>
        </div>
      </footer>
    </div>
  );
}
