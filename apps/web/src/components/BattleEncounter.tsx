import { useEffect, useReducer } from "react";
import { battleReducer, initialBattleState } from "../game/battleState";

export function BattleEncounter() {
  const [battle, dispatch] = useReducer(battleReducer, initialBattleState);

  useEffect(() => {
    if (battle.turn !== "enemy") return;
    const timeoutId = window.setTimeout(() => dispatch({ type: "enemy/attack" }), 520);
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
          {battle.turn === "player" ? "YOUR TURN" : battle.turn === "enemy" ? "ENEMY TURN" : battle.turn === "won" ? "CLEARED" : "SUB DAMAGED"}
        </span>
      </div>

      <div className={`battle-scene${battle.turn === "enemy" ? " enemy-attacking" : ""}`}>
        <div className="submersible" role="img" aria-label="Your submersible">⌁</div>
        <div className="scene-divider" aria-hidden="true" />
        <div className="anglerfish" role="img" aria-label="Anglerfish opponent">
          <span className="fish-lure" />
          <span className="fish-eye" />
          <span className="fish-mouth" />
        </div>
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
        <button className="attack-button" type="button" disabled={battle.turn !== "player"} onClick={() => dispatch({ type: "player/attack" })}>
          <span aria-hidden="true">⌁</span> Sonar pulse <kbd>ENTER</kbd>
        </button>
        {finished && <button className="reset-button" type="button" onClick={() => dispatch({ type: "battle/reset" })}>Reset encounter</button>}
      </div>
      <p className="battle-footnote">Turns resolve automatically · Each sonar pulse deals 7 damage</p>
    </section>
  );
}
