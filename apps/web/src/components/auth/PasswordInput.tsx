import { useState, type ChangeEventHandler, type InputHTMLAttributes } from "react";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

export function PasswordInput({
  id,
  label,
  value,
  placeholder = "••••••••••••",
  error,
  autoComplete = "current-password",
  disabled = false,
  required = false,
  className = "",
  onChange,
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const errorId = `${id}-error`;

  return (
    <div className={`terminal-field-group ${error ? "has-error" : ""} ${isFocused ? "is-focused" : ""} ${disabled ? "is-disabled" : ""} ${className}`}>
      <div className="terminal-field-header">
        <label htmlFor={id} className="terminal-field-label">
          {label}
          {required && <span className="required-star" aria-hidden="true">*</span>}
        </label>
        {isFocused && !error && (
          <span className="terminal-field-status text-cyan" aria-hidden="true">
            ACTIVE
          </span>
        )}
      </div>

      <div className="terminal-input-wrapper has-toggle-btn">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={onChange}
          className="terminal-text-input"
          {...props}
        />

        <button
          type="button"
          disabled={disabled}
          className="pixel-toggle-btn"
          onClick={() => setIsVisible((v) => !v)}
          aria-label={isVisible ? "Hide password" : "Show password"}
          title={isVisible ? "Hide password" : "Show password"}
        >
          {isVisible ? (
            /* Pixel Eye Slash */
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
            /* Pixel Eye */
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
      </div>

      {error && (
        <div id={errorId} className="terminal-field-error" role="alert">
          <span className="error-bullet" aria-hidden="true">!</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
