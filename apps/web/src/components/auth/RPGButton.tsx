import { forwardRef, type ButtonHTMLAttributes } from "react";

export interface RPGButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "gold";
  isLoading?: boolean;
  loadingText?: string;
}

export const RPGButton = forwardRef<HTMLButtonElement, RPGButtonProps>(
  (
    {
      children,
      variant = "primary",
      isLoading = false,
      loadingText,
      disabled,
      className = "",
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`rpg-btn rpg-btn-${variant} ${isLoading ? "is-loading" : ""} ${className}`}
        {...props}
      >
        <span className="rpg-btn-content">
          {isLoading ? (
            <span className="rpg-btn-loading-state">
              <span className="radar-mini-pulse" aria-hidden="true" />
              <span>{loadingText || "PROCESSING..."}</span>
            </span>
          ) : (
            <>
              <span className="rpg-caret" aria-hidden="true">▶</span>
              <span className="rpg-label">{children}</span>
            </>
          )}
        </span>
      </button>
    );
  }
);

RPGButton.displayName = "RPGButton";
