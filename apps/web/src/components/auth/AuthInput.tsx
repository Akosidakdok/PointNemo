import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

export interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: string;
  icon?: ReactNode;
  showPasswordToggle?: boolean;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  (
    {
      id,
      label,
      type = "text",
      error,
      hint,
      icon,
      showPasswordToggle = false,
      disabled,
      required,
      className = "",
      ...props
    },
    ref
  ) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const inputId = id || `auth-input-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const effectiveType = showPasswordToggle ? (isPasswordVisible ? "text" : "password") : type;

    return (
      <div className={`auth-input-group ${error ? "has-error" : ""} ${disabled ? "is-disabled" : ""} ${className}`}>
        <div className="auth-label-row">
          <label htmlFor={inputId} className="auth-label">
            {label}
            {required && <span className="required-star" aria-hidden="true">*</span>}
          </label>
          {hint && !error && (
            <span id={hintId} className="auth-hint">
              {hint}
            </span>
          )}
        </div>

        <div className="auth-input-wrapper">
          {icon && <span className="auth-input-left-icon" aria-hidden="true">{icon}</span>}

          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={`auth-input ${icon ? "has-left-icon" : ""} ${showPasswordToggle ? "has-right-toggle" : ""}`}
            {...props}
          />

          {showPasswordToggle && (
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setIsPasswordVisible(!isPasswordVisible)}
              disabled={disabled}
              aria-label={isPasswordVisible ? "HIDE PASSWORD" : "SHOW PASSWORD"}
              title={isPasswordVisible ? "Hide password" : "Show password"}
            >
              {isPasswordVisible ? (
                /* Pixel Eye Slash Icon */
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="currentColor"
                  aria-hidden="true"
                  className="pixel-art"
                >
                  <path d="M2 2h2v2h2v2H4V4H2V2zm4 4h2v2H6V6zm2 2h2v2H8V8zm2 2h2v2h-2v-2zm2 2h2v2h-2v-2zm2 2h2v2h-2v-2z" />
                  <path d="M1 9c1-3 4-5 8-5 1 0 2 0 3 1l-2 2c-.3 0-.7-.1-1-.1-2.2 0-4 1.3-5 2.1 1 1 2.3 2 4 2 .4 0 .7 0 1-.1l1.5 1.5C10.5 14 9.8 14 9 14c-4 0-7-2-8-5z" />
                </svg>
              ) : (
                /* Pixel Eye Icon */
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="currentColor"
                  aria-hidden="true"
                  className="pixel-art"
                >
                  <path d="M9 4C5 4 2 6 1 9c1 3 4 5 8 5s7-2 8-5c-1-3-4-5-8-5zm0 8c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3zm0-4.5c-.8 0-1.5.7-1.5 1.5S8.2 10.5 9 10.5 10.5 9.8 10.5 9 9.8 7.5 9 7.5z" />
                </svg>
              )}
            </button>
          )}
        </div>

        <div id={errorId} className="auth-field-error" role={error ? "alert" : undefined} aria-live="polite">
          {error && (
            <>
            <span className="field-error-bullet" aria-hidden="true">■</span>
            <span>{error}</span>
            </>
          )}
        </div>
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";
