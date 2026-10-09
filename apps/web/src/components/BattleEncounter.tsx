import { useEffect, useReducer, useRef } from "react";
import { battleReducer, initialBattleState } from "../game/battleState";
import { BattleEffects, type BattleEffectsHandle } from "./BattleEffects";

export function BattleEncounter() {
  const [battle, dispatch] = useReducer(battleReducer, initialBattleState);
  const sceneRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const enemyRef = useRef<HTMLDivElement>(null);
  const effectsRef = useRef<BattleEffectsHandle>(null);

  useEffect(() => {
    let timeoutId: number | undefined;
    if (battle.turn === "player-attack") {
      timeoutId = window.setTimeout(() => {
        effectsRef.current?.play("effects.sonar-hit", "enemy", "above-actors");
        dispatch({ type: "player/attack-hit" });
      }, 180);
    } else if (battle.turn === "enemy") {
      timeoutId = window.setTimeout(() => dispatch({ type: "enemy/attack-start" }), 300);
    } else if (battle.turn === "enemy-attack") {
      timeoutId = window.setTimeout(() => {
        effectsRef.current?.play("effects.hull-hit", "player", "above-actors");
        dispatch({ type: "enemy/attack-hit" });
      }, 220);
    }
    return () => window.clearTimeout(timeoutId);
  }, [battle.turn]);

  const finished = battle.turn === "won" || battle.turn === "lost";

  return (
    <section className={`battle-card${battle.turn === "won" ? " battle-won" : ""}`} aria-labelledby="battle-title">
      <div className="battle-topline">
        <div>
          <p className="eyebrow">TURN-BASED ENCOUNTER</p>
          <h2 id="battle-title">Anglerfish ambush</h2>
        </div>
        <span className={`turn-indicator turn-${battle.turn}`} aria-live="polite">
          {battle.turn === "player" ? "YOUR TURN" : battle.turn === "player-attack" ? "PULSE IN FLIGHT" : battle.turn === "enemy" ? "ENEMY TURN" : battle.turn === "enemy-attack" ? "INCOMING" : battle.turn === "won" ? "CLEARED" : "SUB DAMAGED"}
        </span>
      </div>

      <div ref={sceneRef} className={`battle-scene${battle.turn === "enemy-attack" ? " enemy-attacking" : ""}`}>
        <div ref={playerRef} className="submersible" role="img" aria-label="Your submersible">⌁</div>
        <div className="scene-divider" aria-hidden="true" />
        <div ref={enemyRef} className="anglerfish" role="img" aria-label="Anglerfish opponent">
          <span className="fish-lure" />
          <span className="fish-eye" />
          <span className="fish-mouth" />
        </div>
        <BattleEffects ref={effectsRef} sceneRef={sceneRef} playerRef={playerRef} enemyRef={enemyRef} />
        <span className="scene-depth">ABYSSAL ZONE · 4,180 M</span>
        <span className="scene-caption">BIOLUMINESCENT SIGNAL DETECTED</span>
      </div>

      <div className="combatants">
        <div className="combatant">
          <div className="combatant-name"><span>◌</span> NAUTILUS-01 <b>PLAYER</b></div>
          <div className="health-track" role="progressbar" aria-label="Submersible health" aria-valuemin={0} aria-valuemax={28} aria-valuenow={battle.playerHealth}>
            <div className="health-fill player-health" style={{ width: `${(battle.playerHealth / 28) * 100}%` }} />
          </div>
          <span className="health-label">HULL INTEGRITY <b>{battle.playerHealth} / 28</b></span>
        </div>
        <div className="combatant">
          <div className="combatant-name"><span>◉</span> ANGLERFISH <b>ENCOUNTER</b></div>
          <div className="health-track" role="progressbar" aria-label="Anglerfish health" aria-valuemin={0} aria-valuemax={21} aria-valuenow={battle.enemyHealth}>
            <div className="health-fill enemy-health" style={{ width: `${(battle.enemyHealth / 21) * 100}%` }} />
          </div>
          <span className="health-label">THREAT LEVEL <b>{battle.enemyHealth} / 21</b></span>
        </div>
      </div>

      <p className="battle-message" aria-live="polite">{battle.message}</p>
      <div className="battle-actions">
        <button
          className="attack-button"
          type="button"
          aria-disabled={!finished && battle.turn !== "player"}
          onClick={() => {
            if (finished) {
              effectsRef.current?.clear();
              dispatch({ type: "battle/reset" });
            } else if (battle.turn === "player") {
              effectsRef.current?.play("effects.sonar-cast", "player", "behind-actors");
              dispatch({ type: "player/attack-start" });
            }
          }}
        >
          <span aria-hidden="true">⌁</span> {finished ? "Reset encounter" : "Sonar pulse"} <kbd>ENTER</kbd>
        </button>
      </div>
      <p className="battle-footnote">Turns resolve automatically · Each sonar pulse deals 7 damage</p>
    </section>
  );
}
