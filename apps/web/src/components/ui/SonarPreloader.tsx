import { GameButton } from "./GameButton";

export interface SonarPreloaderProps {
  progress: number;
  total: number;
  statusText?: string;
  error?: string | null;
  onRetry?: () => void;
}

export function SonarPreloader({
  progress,
  total,
  statusText = "INITIALIZING HADAL SENSORS…",
  error = null,
  onRetry,
}: SonarPreloaderProps) {
  const percent = total > 0 ? Math.round((progress / total) * 100) : 0;
  const simulatedDepth = Math.round((percent / 100) * 10935);

  return (
    <div className="sonar-preloader" role="region" aria-label="Game asset loader">
      <div className="preloader-card pixel-panel">
        <div className="preloader-radar" aria-hidden="true">
          <div className="radar-grid" />
          <div className="radar-sweep" />
          <div className="radar-blip blip-center" />
          <div className="radar-blip blip-signal" />
        </div>

        <div className="preloader-info">
          <p className="preloader-eyebrow">FIELD EQUIPMENT CHECK</p>
          <h1 className="preloader-title">POINT NEMO</h1>
          <p className="preloader-depth">
            TELEMETRY DEPTH: <b>{simulatedDepth.toLocaleString()}</b> <small>METERS</small>
          </p>

          {!error ? (
            <>
              <div
                className="preloader-bar"
                role="progressbar"
                aria-label="Atlas assets preloading progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div className="preloader-fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="preloader-status-row">
                <span className="preloader-status-text">{statusText}</span>
                <span className="preloader-percent">{percent}%</span>
              </div>
            </>
          ) : (
            <div className="preloader-error" role="alert">
              <p className="error-title">SUBSYSTEM INITIALIZATION FAILED</p>
              <p className="error-msg">{error}</p>
              {onRetry && (
                <GameButton variant="primary" size="md" onClick={onRetry}>
                  RETRY CALIBRATION
                </GameButton>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
