import { useEffect, useReducer, useRef } from "react";
import { battleReducer, initialBattleState } from "../game/battleState";
import { type AssetBundle, drawFrame, speciesScale } from "../game/sprites";
import { GameButton } from "./ui/GameButton";
import { type BattleEffectsHandle } from "./BattleEffects";

export interface BattleEncounterProps {
  bundle?: AssetBundle | null;
  onClose?: () => void;
}

export function BattleEncounter({ bundle, onClose }: BattleEncounterProps) {
  const [battle, dispatch] = useReducer(battleReducer, initialBattleState);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const effectsRef = useRef<BattleEffectsHandle | null>(null);

  useEffect(() => {
    if (battle.turn === "enemy") {
      const timeoutId = window.setTimeout(() => dispatch({ type: "enemy/attack-start" }), 600);
      return () => window.clearTimeout(timeoutId);
    }
    if (battle.turn === "enemy-attack") {
      const timeoutId = window.setTimeout(() => dispatch({ type: "enemy/attack-hit" }), 500);
      return () => window.clearTimeout(timeoutId);
    }
    if (battle.turn === "player-attack") {
      const timeoutId = window.setTimeout(() => dispatch({ type: "player/attack-hit" }), 500);
      return () => window.clearTimeout(timeoutId);
    }
  }, [battle.turn]);

  // Handle keyboard ENTER to attack
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (battle.turn === "won" || battle.turn === "lost") {
          effectsRef.current?.clear();
          dispatch({ type: "battle/reset" });
        } else if (battle.turn === "player") {
          effectsRef.current?.play("effects.sonar-cast", "player", "behind-actors");
          dispatch({ type: "player/attack-start" });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [battle.turn]);

  // Canvas drawing for combatants
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bundle) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.05;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;

      // Dark abyssal gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#061426");
      grad.addColorStop(1, "#0b1e38");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Subtle depth grid lines
      ctx.strokeStyle = "rgba(66, 104, 135, 0.2)";
      ctx.lineWidth = 1;
      for (let y = 16; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 1. Draw Player (Explorer facing right)
      const explorerScale = speciesScale(bundle, "explorer", 70);
      const playerY = Math.round(height * 0.55 + Math.sin(t) * 3);
      drawFrame(ctx, bundle, "explorer.right.0", 80, playerY, explorerScale);

      // 2. Draw Enemy (Blobfish profile facing left)
      const blobfishScale = speciesScale(bundle, "blobfish", 82);
      const isEnemyAttacking = battle.turn === "enemy";
      const lungeOffset = isEnemyAttacking ? Math.sin(t * 8) * 12 : 0;
      const enemyX = Math.round(width - 90 - lungeOffset);
      const enemyY = Math.round(height * 0.55 + Math.cos(t * 0.8) * 4);

      // Draw blobfish profile frame
      const blobfishFrame = Math.floor(t * 2) % 2 === 0 ? "blobfish.1.0" : "blobfish.1.1";
      drawFrame(ctx, bundle, blobfishFrame, enemyX, enemyY, blobfishScale);

      // Sonar pulse FX if player just attacked
      if (battle.turn === "enemy") {
        ctx.beginPath();
        ctx.arc(100 + (t * 50) % 180, playerY, 20, -Math.PI * 0.3, Math.PI * 0.3);
        ctx.strokeStyle = "rgba(48, 214, 242, 0.6)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [bundle, battle.turn]);

  const finished = battle.turn === "won" || battle.turn === "lost";

  return (
    <section className="battle-encounter pixel-panel" aria-labelledby="battle-title">
      <div className="battle-topline">
        <div>
          <p className="encounter-eyebrow">TACTICAL SONAR ENGAGEMENT</p>
          <h2 id="battle-title" className="encounter-heading">HADAL BLOBFISH ENCOUNTER</h2>
        </div>
        <div className="encounter-header-badges">
          <span className={`turn-badge turn-${battle.turn}`} aria-live="polite">
            {battle.turn === "player"
              ? "STATUS: YOUR TURN"
              : battle.turn === "enemy"
              ? "STATUS: CREATURE ATTACKING"
              : battle.turn === "won"
              ? "STATUS: PATH CLEARED"
              : "STATUS: HULL DAMAGED"}
          </span>
          {onClose && (
            <GameButton variant="secondary" size="sm" onClick={onClose} aria-label="Close encounter">
              ✕
            </GameButton>
          )}
        </div>
      </div>

      {/* 16-bit Battle Arena Canvas */}
      <div className="battle-arena" aria-hidden="true">
        <canvas
          ref={canvasRef}
          width={480}
          height={160}
          className="battle-canvas pixel-art"
        />
        <div className="arena-overlay">
          <span className="depth-tag">DEPTH: 4,180 M · ABYSSAL ZONE</span>
          <span className="specimen-tag">SPECIMEN: PSYCHROLUTES PSYCHROLUTES</span>
        </div>
      </div>

      {/* Combatant Gauges */}
      <div className="combatants-grid">
        <div className="combatant-card">
          <div className="combatant-label">
            <span className="combatant-icon" aria-hidden="true">⌁</span>
            <span className="combatant-name">SUBMERSIBLE (NAUTILUS-01)</span>
          </div>
          <div
            className="combatant-track"
            role="progressbar"
            aria-label="Submersible hull integrity"
            aria-valuemin={0}
            aria-valuemax={28}
            aria-valuenow={battle.playerHealth}
          >
            <div
              className="track-fill player-fill"
              style={{ width: `${(battle.playerHealth / 28) * 100}%` }}
            />
          </div>
          <div className="track-stats">
            <span>HULL INTEGRITY</span>
            <b>{battle.playerHealth} / 28</b>
          </div>
        </div>

        <div className="combatant-card">
          <div className="combatant-label">
            <span className="combatant-icon enemy-icon" aria-hidden="true">◉</span>
            <span className="combatant-name">BLOBFISH THREAT</span>
          </div>
          <div
            className="combatant-track"
            role="progressbar"
            aria-label="Blobfish threat level"
            aria-valuemin={0}
            aria-valuemax={21}
            aria-valuenow={battle.enemyHealth}
          >
            <div
              className="track-fill enemy-fill"
              style={{ width: `${(battle.enemyHealth / 21) * 100}%` }}
            />
          </div>
          <div className="track-stats">
            <span>ORGANIC THREAT</span>
            <b>{battle.enemyHealth} / 21</b>
          </div>
        </div>
      </div>

      {/* Battle Narrative */}
      <p className="battle-log" aria-live="polite">
        {battle.message}
      </p>

      {/* Action Controls */}
      <div className="battle-actions">
        <GameButton
          variant={finished ? "secondary" : "primary"}
          size="md"
          disabled={!finished && battle.turn !== "player"}
          onClick={() => {
            if (finished) {
              effectsRef.current?.clear();
              dispatch({ type: "battle/reset" });
            } else if (battle.turn === "player") {
              effectsRef.current?.play("effects.sonar-cast", "player", "behind-actors");
              dispatch({ type: "player/attack-start" });
            }
          }}
          className="battle-action-btn"
        >
          {finished ? "↺ RESET ENCOUNTER" : "⌁ EMIT DISPERSAL PULSE"} <kbd>ENTER</kbd>
        </GameButton>
      </div>
      <p className="battle-hint">
        Each sonar pulse resonates at 7 harmonic damage · Auto-resolves creature response
      </p>
    </section>
  );
}
