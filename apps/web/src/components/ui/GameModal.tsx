import { useEffect, useRef, type ReactNode } from "react";
import { GameButton } from "./GameButton";

export interface GameModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  subtitle?: string;
  footer?: ReactNode;
  maxWidth?: string;
}

export function GameModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "560px",
}: GameModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      // Focus modal or close button on open
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        previouslyFocusedRef.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="game-modal pixel-panel"
        style={{ maxWidth }}
      >
        <div className="modal-header">
          <div>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            <h2 id="modal-title" className="modal-title">{title}</h2>
          </div>
          <GameButton
            ref={closeButtonRef}
            variant="secondary"
            size="sm"
            onClick={onClose}
            aria-label="Close dialog"
            className="modal-close-button"
          >
            ✕
          </GameButton>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
