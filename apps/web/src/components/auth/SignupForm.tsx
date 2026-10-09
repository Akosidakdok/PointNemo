import { useEffect, useRef, useState, type FormEvent } from "react";
import { TerminalInput } from "./TerminalInput";
import { PasswordInput } from "./PasswordInput";
import { RPGButton } from "./RPGButton";
import { validateSignup } from "./auth.validation";
import { type AuthenticatedUser, type AuthValidationErrors, type AuthViewState } from "./auth.types";

export interface SignupFormProps {
  onSuccess: (user: AuthenticatedUser) => void;
  onSwitchToLogin: () => void;
}

export function SignupForm({ onSuccess, onSwitchToLogin }: SignupFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<AuthValidationErrors>({});
  const [viewState, setViewState] = useState<AuthViewState>("idle");
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pendingTimeout.current !== null) clearTimeout(pendingTimeout.current);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pendingTimeout.current !== null) return;

    const validationErrors = validateSignup(displayName, email, password, confirmPassword);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setViewState("error");
      return;
    }

    setErrors({});
    setViewState("submitting");

    pendingTimeout.current = setTimeout(() => {
      setViewState("success");
      pendingTimeout.current = setTimeout(() => {
        onSuccess({
          displayName: displayName.trim(),
          email: email.trim(),
          remembered: true,
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
            <b>EXPLORER REGISTERED</b>
            <p>EXPEDITION READY</p>
          </div>
        </div>
      )}

      {errors.general && (
        <div className="auth-status-alert alert-error" role="alert">
          <span className="status-badge-icon" aria-hidden="true">!</span>
          <div>
            <b>REGISTRATION REJECTED</b>
            <p>{errors.general}</p>
          </div>
        </div>
      )}

      <TerminalInput
        id="signup-name"
        label="DISPLAY NAME"
        type="text"
        autoComplete="name"
        placeholder="Captain Nemo"
        value={displayName}
        disabled={isLocked}
        error={errors.displayName}
        onChange={(e) => {
          setDisplayName(e.target.value);
          if (errors.displayName) setErrors((prev) => ({ ...prev, displayName: undefined }));
        }}
        required
      />

      <TerminalInput
        id="signup-email"
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
        id="signup-password"
        label="PASSWORD"
        autoComplete="new-password"
        value={password}
        disabled={isLocked}
        error={errors.password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
        }}
        required
      />

      <PasswordInput
        id="signup-confirm-password"
        label="CONFIRM PASSWORD"
        autoComplete="new-password"
        value={confirmPassword}
        disabled={isLocked}
        error={errors.confirmPassword}
        onChange={(e) => {
          setConfirmPassword(e.target.value);
          if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
        }}
        required
      />

      <div className="password-rule-pill" aria-live="polite">
        <span className={password.length >= 8 ? "text-cyan" : "text-muted"}>
          {password.length >= 8 ? "✓" : "■"} At least 8 characters
        </span>
      </div>

      {/* Primary CTA */}
      <div className="form-submit-row">
        <RPGButton
          type="submit"
          variant="primary"
          isLoading={viewState === "submitting"}
          loadingText="REGISTERING EXPLORER..."
          disabled={isLocked}
          className="auth-primary-btn"
        >
          CREATE EXPLORER
        </RPGButton>
      </div>

      {/* Secondary Action */}
      <div className="form-switch-prompt">
        <span>Already registered?</span>{" "}
        <button
          type="button"
          className="rpg-inline-btn"
          onClick={onSwitchToLogin}
          disabled={isLocked}
        >
          Log in
        </button>
      </div>
    </form>
  );
}
