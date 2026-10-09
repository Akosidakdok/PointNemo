import { useEffect, useRef, useState, type FormEvent } from "react";
import { TerminalInput } from "./TerminalInput";
import { PasswordInput } from "./PasswordInput";
import { RPGButton } from "./RPGButton";
import { validateLogin } from "./auth.validation";
import { type AuthenticatedUser, type AuthValidationErrors, type AuthViewState } from "./auth.types";

export interface LoginFormProps {
  onSuccess: (user: AuthenticatedUser) => void;
  onSwitchToSignup: () => void;
}

export function LoginForm({ onSuccess, onSwitchToSignup }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<AuthValidationErrors>({});
  const [viewState, setViewState] = useState<AuthViewState>("idle");
  const [showForgotNotice, setShowForgotNotice] = useState(false);
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pendingTimeout.current !== null) clearTimeout(pendingTimeout.current);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pendingTimeout.current !== null) return;
    setShowForgotNotice(false);

    const validationErrors = validateLogin(email, password);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setViewState("error");
      return;
    }

    setErrors({});
    setViewState("submitting");

    // Local authentication delay
    pendingTimeout.current = setTimeout(() => {
      setViewState("success");
      pendingTimeout.current = setTimeout(() => {
        onSuccess({
          displayName: email.split("@")[0] || "Explorer",
          email: email.trim(),
          remembered: rememberMe,
        });
      }, 750);
    }, 850);
  };

  const isLocked = viewState === "submitting" || viewState === "success";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`auth-inner-form ${viewState === "error" ? "form-shake" : ""}`}
    >
      {viewState === "success" && (
        <div className="auth-status-alert alert-success" role="status" aria-live="polite">
          <span className="status-badge-icon" aria-hidden="true">✓</span>
          <div>
            <b>IDENTITY CONFIRMED</b>
            <p>WELCOME BACK, EXPLORER</p>
          </div>
        </div>
      )}

      {errors.general && (
        <div className="auth-status-alert alert-error" role="alert">
          <span className="status-badge-icon" aria-hidden="true">!</span>
          <div>
            <b>ACCESS DENIED</b>
            <p>{errors.general}</p>
          </div>
        </div>
      )}

      <TerminalInput
        id="login-email"
        label="EMAIL"
        type="email"
        autoComplete="email"
        placeholder="diver@email.com"
        value={email}
        disabled={isLocked}
        error={errors.email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
        }}
        required
      />

      <PasswordInput
        id="login-password"
        label="PASSWORD"
        autoComplete="current-password"
        value={password}
        disabled={isLocked}
        error={errors.password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
        }}
        required
      />

      {/* Remember me & Forgot Password */}
      <div className="form-sub-row">
        <label className="rpg-checkbox-label">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLocked}
          />
          <span className="rpg-check-box" aria-hidden="true" />
          <span>Remember me</span>
        </label>

        <button
          type="button"
          className="rpg-text-link"
          onClick={() => setShowForgotNotice((prev) => !prev)}
          disabled={isLocked}
        >
          Forgot password?
        </button>
      </div>

      {showForgotNotice && (
        <div className="forgot-terminal-note" role="note">
          <span className="note-tag">[LOCAL RECOVERY]</span>
          <p>
            Point Nemo runs offline on your device. To reset a forgotten password, continue as Guest
            or clear browser storage.
          </p>
        </div>
      )}

      {/* Primary CTA */}
      <div className="form-submit-row">
        <RPGButton
          type="submit"
          variant="primary"
          isLoading={viewState === "submitting"}
          loadingText="AUTHENTICATING..."
          disabled={isLocked}
          className="auth-primary-btn"
        >
          BEGIN DESCENT
        </RPGButton>
      </div>

      {/* Secondary Action */}
      <div className="form-switch-prompt">
        <span>New explorer?</span>{" "}
        <button
          type="button"
          className="rpg-inline-btn"
          onClick={onSwitchToSignup}
          disabled={isLocked}
        >
          Create profile
        </button>
      </div>
    </form>
  );
}
