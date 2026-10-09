# UI Playground Handoff

## Where this UI sits

The broader app sequence is **Title → Login / Sign up → Local Library → Sonar → Ocean Descent → Point Nemo review → Results**. The playground begins at **Local Library**, after the title and login screens. Those two entry screens are context only: they are not implemented here, and accounts/authentication remain outside the functional hackathon MVP.

The playground is a frontend-only preview at `apps/web/ui-playground`. It helps review the five MVP modules in [WEB_APP_FLOW.md](WEB_APP_FLOW.md); it does not connect to the local API, Ollama, or SQLite.

## Module order

| Module | Playground screen | Purpose |
| --- | --- | --- |
| 1. Local Library & Document Intake | Library | Select one English text-based PDF and preview the saved local library |
| 2. Sonar / Local AI Processing | Sonar | Preview Extraction → Generation → Validation states |
| 3. Ocean Descent | Descent | Preview question, answer feedback, HP, XP, and source evidence |
| 4. Point Nemo Boss Review | Point Nemo | Preview the mixed-topic final encounter |
| 5. Results & Saved Progress | Results | Preview completion, scores, retry, and return to library |

Use the module order and feature boundaries from `WEB_APP_FLOW.md` when changing the MVP screens, navigation, or content.

## Standalone playground pages

The Profile and Leaderboard pages are additional frontend-only previews outside the five-step MVP flow. Profile is opened by the top-bar button immediately after the light/dark theme control. Leaderboard is a separate tab after the five main flow tabs. Their values and names are sample content; neither page uses account data, a backend API, or an online leaderboard. Keep them visually separate from the MVP modules unless product scope changes.

## Existing art and sprite sheets

Use the prepared runtime atlases under `assets/prepared/runtime/` in the browser. They are derived from source sheets in `assets/characters/` and `assets/enemies/`, with their frame rectangles and animations described in `assets/prepared/runtime/manifest.json`. Use `src/assets/sprites.js` (`loadAssetBundle`, `SpriteAnimation`, `drawFrame`, `drawWater`, `speciesScale`) to draw them; preserve the manifest anchors, frame scale, and disabled canvas smoothing.

The playground currently draws:

- Explorer animation from `explorer.png` in the Library and Descent scenes.
- Barreleye animation from `barreleye.png` in the Library scene.
- Goblin shark from `goblin.png` as a labeled placeholder in the Point Nemo scene. There is no Megalodon sprite yet.
- Water from `water.png` and answer effects from `effects.png`.
- `waves.svg` as a masked background layer, tinted by the active light or dark theme.

There is no Clownfish sprite in the current roster, so keep that small Surface icon identified as a UI placeholder. Do not use the original white-background concept sheets directly as runtime sprite images; use the prepared atlas and manifest.

## Visual direction

The current playground uses translucent glass panels over a blue water backdrop. Light mode uses white and pale blue. Dark mode uses deep navy with blue/cyan highlights and a smooth theme transition. Existing pixel art should remain crisp and visible. Do not add authentication or backend calls to the standalone preview pages.

## Run locally

From the repository root in Command Prompt:

```cmd
npm run dev:playground --workspace=@point-nemo/web
```

Open `http://127.0.0.1:5174`. The playground Vite config serves `assets/prepared/runtime` as its public directory.
