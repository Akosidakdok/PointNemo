import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
}

export const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(
  ({ children, variant = "secondary", size = "md", icon, className = "", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={`game-button btn-${variant} btn-${size} ${className}`}
        {...props}
      >
        {icon && <span className="btn-icon" aria-hidden="true">{icon}</span>}
        <span className="btn-label">{children}</span>
      </button>
    );
  }
);

GameButton.displayName = "GameButton";
