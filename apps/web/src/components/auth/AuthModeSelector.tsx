import { type AuthMode } from "./auth.types";

export interface AuthModeSelectorProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
  disabled?: boolean;
}

export function AuthModeSelector({ mode, onChange, disabled = false }: AuthModeSelectorProps) {
  return (
    <div className="auth-mode-selector-rpg" role="tablist" aria-label="Expedition Entry Mode">
      <button
        type="button"
        role="tab"
        id="tab-mode-login"
        aria-selected={mode === "login"}
        aria-controls="panel-auth-form"
        disabled={disabled}
        className={`rpg-mode-btn ${mode === "login" ? "is-active" : ""}`}
        onClick={() => onChange("login")}
      >
        <span className="mode-cursor" aria-hidden="true">
          {mode === "login" ? "▶" : " "}
        </span>
        <span className="mode-text">LOGIN</span>
      </button>

      <button
        type="button"
        role="tab"
        id="tab-mode-signup"
        aria-selected={mode === "signup"}
        aria-controls="panel-auth-form"
        disabled={disabled}
        className={`rpg-mode-btn ${mode === "signup" ? "is-active" : ""}`}
        onClick={() => onChange("signup")}
      >
        <span className="mode-cursor" aria-hidden="true">
          {mode === "signup" ? "▶" : " "}
        </span>
        <span className="mode-text">NEW EXPLORER</span>
      </button>
    </div>
  );
}
