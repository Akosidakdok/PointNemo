import { useState } from "react";
import { AuthModeSelector } from "./AuthModeSelector";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { type AuthMode, type AuthenticatedUser } from "./auth.types";

export interface AuthPanelProps {
  onSuccess: (user: AuthenticatedUser) => void;
  onGuestAccess: () => void;
}

export function AuthPanel({ onSuccess, onGuestAccess }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <div className="rpg-auth-panel" role="region" aria-label="Expedition Terminal Authentication">
      {/* Panel Top Terminal Header */}
      <div className="terminal-top-badge">
        <span className="terminal-blip" aria-hidden="true" />
        <span className="terminal-id">EXPEDITION TERMINAL // PN-01</span>
      </div>

      {/* Mode Selector */}
      <AuthModeSelector mode={mode} onChange={setMode} />

      {/* Sub-header instruction */}
      <div className="auth-mode-headline">
        <h2 className="mode-main-title">
          {mode === "login" ? "WELCOME BACK, EXPLORER" : "NEW EXPLORER REGISTRATION"}
        </h2>
        <p className="mode-sub-title">
          {mode === "login" ? "Resume your oceanic descent." : "Prepare for your first descent."}
        </p>
      </div>

      {/* Mode-specific Form with Transition */}
      <div className="auth-form-slot" id="panel-auth-form" role="tabpanel">
        {mode === "login" ? (
          <LoginForm onSuccess={onSuccess} onSwitchToSignup={() => setMode("signup")} />
        ) : (
          <SignupForm onSuccess={onSuccess} onSwitchToLogin={() => setMode("login")} />
        )}
      </div>

      {/* Offline Guest Option */}
      <div className="guest-divider">
        <span>OR CONTINUE OFFLINE</span>
      </div>

      <button
        type="button"
        className="rpg-guest-btn"
        onClick={onGuestAccess}
      >
        <span className="rpg-caret" aria-hidden="true">▶</span>
        <span>QUICK EXPEDITION (OFFLINE GUEST)</span>
      </button>
    </div>
  );
}
