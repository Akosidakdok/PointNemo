# Repository Agent Guidance

## Current scope

- The current work is frontend-only. Leave backend modules untouched unless the user changes scope.
- On Windows, use Command Prompt (`cmd`), not PowerShell.

## Point Nemo web experience

- Before changing the web flow or playground, read [the UI playground handoff](docs/product/UI_PLAYGROUND_HANDOFF.md) and [the web app flow](docs/product/WEB_APP_FLOW.md).
- The wider app order is Title → Login / Sign up → Local Library → Sonar → Ocean Descent → Point Nemo review → Results.
- `apps/web/ui-playground` begins at the post-title, post-login Local Library screen. It does not implement the title/login screens or authentication. Keep account functionality out of the functional MVP unless the user explicitly changes scope.
- Keep the five-step MVP flow in `WEB_APP_FLOW.md` intact. Profile and Leaderboard are standalone, sample-data playground pages requested for frontend review; do not imply they are connected to accounts, a network leaderboard, the API, Ollama, or SQLite.

## Visual assets

- Use `assets/prepared/runtime/` and its `manifest.json` for web sprites. The source concept sheets under `assets/characters/` and `assets/enemies/` have white backgrounds and are not runtime atlases.
- Use `src/assets/sprites.js` for atlas loading and rendering. Preserve manifest anchors and a consistent scale per species.
- The current UI uses the Goblin shark as a labeled Megalodon placeholder and a CSS icon for the Clownfish encounter because those sprites are not present yet.
