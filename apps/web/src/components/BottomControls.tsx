import { GameButton } from "./ui/GameButton";

export interface BottomControlsProps {
  onSonar: () => void;
  onQuickDive: () => void;
  currentObjective: string;
}

export function BottomControls({
  onSonar,
  onQuickDive,
  currentObjective,
}: BottomControlsProps) {
  return (
    <footer className="bottom-controls" aria-label="Expedition action controls">
      <div className="objective-capsule">
        <span className="objective-tag">OBJECTIVE</span>
        <span className="objective-text">{currentObjective}</span>
      </div>

      <div className="action-button-group">
        <GameButton
          variant="primary"
          size="md"
          onClick={onSonar}
          aria-label="Emit sonar pulse (shortcut: Spacebar)"
          className="sonar-pulse-btn"
        >
          ⌁ EMIT SONAR <kbd>SPACE</kbd>
        </GameButton>
        <GameButton
          variant="secondary"
          size="md"
          onClick={onQuickDive}
          aria-label="Descend deeper into hadal trench"
        >
          ▼ DESCEND +250M
        </GameButton>
      </div>
    </footer>
  );
}
