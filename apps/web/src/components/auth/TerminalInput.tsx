import { useState, type ChangeEventHandler, type InputHTMLAttributes } from "react";

export interface TerminalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  id: string;
  label: string;
  type?: string;
  value: string;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

export function TerminalInput({
  id,
  label,
  type = "text",
  value,
  placeholder,
  error,
  autoComplete,
  disabled = false,
  required = false,
  className = "",
  onChange,
  ...props
}: TerminalInputProps) {
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

      <div className="terminal-input-wrapper">
        <input
          id={id}
          type={type}
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
