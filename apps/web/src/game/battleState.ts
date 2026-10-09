export type BattleTurn = "player" | "player-attack" | "enemy" | "enemy-attack" | "won" | "lost";

export interface BattleState {
  playerHealth: number;
  enemyHealth: number;
  turn: BattleTurn;
  message: string;
}

export type BattleAction =
  | { type: "player/attack-start" }
  | { type: "player/attack-hit" }
  | { type: "enemy/attack-start" }
  | { type: "enemy/attack-hit" }
  | { type: "battle/reset" };

export const initialBattleState: BattleState = {
  playerHealth: 28,
  enemyHealth: 21,
  turn: "player",
  message: "An anglerfish blocks the lesson route. Your move.",
};

export function battleReducer(state: BattleState, action: BattleAction): BattleState {
  if (action.type === "battle/reset") {
    return initialBattleState;
  }

  if (action.type === "player/attack-start" && state.turn === "player") {
    return { ...state, turn: "player-attack", message: "Sonar pulse in flight…" };
  }

  if (action.type === "player/attack-hit" && state.turn === "player-attack") {
    const enemyHealth = Math.max(0, state.enemyHealth - 7);
    if (enemyHealth === 0) {
      return { ...state, enemyHealth, turn: "won", message: "The route is clear. Lesson encounter complete." };
    }
    return { ...state, enemyHealth, turn: "enemy", message: "Sonar pulse lands. The anglerfish is winding up a counterattack…" };
  }

  if (action.type === "enemy/attack-start" && state.turn === "enemy") {
    return { ...state, turn: "enemy-attack", message: "The anglerfish lunges…" };
  }

  if (action.type === "enemy/attack-hit" && state.turn === "enemy-attack") {
    const playerHealth = Math.max(0, state.playerHealth - 4);
    if (playerHealth === 0) {
      return { ...state, playerHealth, turn: "lost", message: "The submersible needs repairs. Reset to try again." };
    }
    return { ...state, playerHealth, turn: "player", message: "The anglerfish strikes for 4. Your turn." };
  }

  return state;
}
