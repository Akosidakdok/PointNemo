import { GameModal } from "./ui/GameModal";
import { GameButton } from "./ui/GameButton";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "CONFIRM",
  cancelLabel = "CANCEL",
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <GameModal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      subtitle="LOCAL DATA MANAGEMENT"
      maxWidth="460px"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <GameButton variant="secondary" size="md" onClick={onCancel}>
            {cancelLabel}
          </GameButton>
          <GameButton
            variant={isDestructive ? "danger" : "primary"}
            size="md"
            onClick={onConfirm}
          >
            {confirmLabel}
          </GameButton>
        </div>
      }
    >
      <p style={{ color: "var(--text-main)", fontSize: "13px", lineHeight: "1.5" }}>
        {message}
      </p>
    </GameModal>
  );
}
