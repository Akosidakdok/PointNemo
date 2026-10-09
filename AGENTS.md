# Repository Agent Guidance

## Current scope

- The current work is frontend-only. Leave backend modules untouched unless the user changes scope.
- On Windows, use Command Prompt (`cmd`), not PowerShell.

## Point Nemo web experience

- Before changing the web flow or playground, read [the UI playground handoff](docs/product/UI_PLAYGROUND_HANDOFF.md) and [the web app flow](docs/product/WEB_APP_FLOW.md).
- The wider app order is Title → Login / Sign up → Local Library → Sonar → Choose a Sea → Ocean Descent → Lesson Boss → Results. Choose a Sea is a state within the Local Library module.
- `apps/web/ui-playground` begins at the post-title, post-login Local Library screen. It does not implement the title/login screens or authentication. Keep account functionality out of the functional MVP unless the user explicitly changes scope.
- Keep the five-step MVP flow in `WEB_APP_FLOW.md` intact. Profile and Leaderboard are standalone, sample-data playground pages requested for frontend review; do not imply they are connected to accounts, a network leaderboard, the API, Ollama, or SQLite.

## Visual assets

- Use `assets/maps/point-nemo-abyss-ocean.png` as the descent's world map and `assets/characters/ocean-explorer-sprite-sheet.png` as its player base. The explorer sheet has a white background; remove it in the renderer when drawing frames, without modifying the source file.
- Use `assets/prepared/runtime/` and its `manifest.json` for overworld creature sprites and effects. Use `src/assets/sprites.js` for atlas loading/rendering and preserve manifest anchors and a consistent scale per species.
- Keep descent instances isolated by lesson/run. The player chooses a saved lesson in the same app tab before entering its map. The player moves with W, A, S, D; only the current enemy marker triggers, and clearing an encounter unlocks the next one.
- The prepared roster has no Clownfish, Giant Squid, or Megalodon. Use an available, clearly labeled prototype sprite until those assets are made.
