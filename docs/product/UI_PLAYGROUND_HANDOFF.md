# UI Playground Handoff

## Where this UI sits

The broader app sequence is **Title → Login / Sign up → Local Library → Sonar → Choose a Sea → Ocean Descent → Lesson Boss → Results**. The playground begins at **Local Library**, after the title and login screens. Those entry screens are not implemented here. The main React app already has local explorer login/signup and guest entry; this preview neither replaces that flow nor connects to its identity. Remote accounts remain outside this change. Choose a Sea is a selection state within the Local Library module, not a new product module.

The playground is a frontend-only preview at `apps/web/ui-playground`. It helps review the five MVP modules in [WEB_APP_FLOW.md](WEB_APP_FLOW.md); it does not connect to the local API, Ollama, or SQLite.

## Integration status

The standalone playground remains a sample preview. The main React app now integrates the library, intake, map, encounters, and final review with saved question sets from the local API. Its map progression remains in React memory rather than the SQLite run engine. Local AI pipeline changes and their migrations are documented in `docs/LOCAL_AI_PIPELINE.md`; the existing local login and guest flow is preserved.

PDF selection in the standalone preview checks the extension/type only and does not read or upload file contents. The integrated safety gate checks PDF signatures and limits files to 5 MiB before upload. The API requires at least 300 non-whitespace characters and samples larger documents within a token budget; it has no fixed three-page or 8,000-character limit. This preview cannot validate extracted text or language. Its Sonar stages, questions, Profile, Leaderboard, and Results use sample content; instance progress lasts only until reload. Leaderboard navigation remains removed from the main app.

## Module order

| Module | Playground screen | Purpose |
| --- | --- | --- |
| 1. Local Library & Document Intake | Library | Select one English text-based PDF and preview the saved local library |
| 2. Sonar / Local AI Processing | Sonar | Preview Extraction → Generation → Validation states |
| 1. Local Library · Choose a Sea | Choose Sea | Select a validated saved lesson; resume its active run or create a new instance |
| 3. Ocean Descent | Descent | WASD through that lesson's map and reach its three topic encounters in order |
| 4. Lesson Boss Review | Lesson Boss | Preview the mixed-topic final encounter at the end of the route |
| 5. Results & Saved Progress | Results | Preview completion, scores, retry, and return to library |

Use the module order and feature boundaries from `WEB_APP_FLOW.md` when changing the MVP screens, navigation, or content.

## Standalone playground pages

The Profile and Leaderboard pages are additional frontend-only previews outside the five-step MVP flow. Profile is opened by the top-bar button immediately after the light/dark theme control. Leaderboard is a separate tab after the five main flow tabs. Their values and names are sample content; neither page uses account data, a backend API, or an online leaderboard. Keep them visually separate from the MVP modules unless product scope changes.

## Existing art and sprite sheets

Use the prepared runtime atlases under `assets/prepared/runtime/` in the browser. They are derived from source sheets in `assets/characters/` and `assets/enemies/`, with their frame rectangles and animations described in `assets/prepared/runtime/manifest.json`. Use `src/assets/sprites.js` (`loadAssetBundle`, `SpriteAnimation`, `drawFrame`, `drawWater`, `speciesScale`) to draw them; preserve the manifest anchors, frame scale, and disabled canvas smoothing.

The playground currently draws:

- Explorer animation from `explorer.png` in the Library and Descent scenes.
- Barreleye animation from `barreleye.png` in the Library scene.
- The square world area from `assets/maps/point-nemo-abyss-ocean.png`, with Point Nemo at its central buoy.
- The player uses the prepared transparent `explorer.png` atlas derived from `assets/characters/ocean-explorer-sprite-sheet.png`. Directional idle/swim sequences, frame rectangles, and anchors come from the manifest; source sheets are not sliced or color-keyed in the browser.
- Barreleye, Gulper, Fringehead, and Goblin Shark sprites from their prepared runtime atlases as overworld enemy markers. These are illustrative route markers, not claims about which creatures appear in the source lesson.
- `water.png` with mirrored repeat for other scene backgrounds, and sonar/hull effects from `effects.png`.
- `waves.svg` as a masked background layer, tinted by the active light or dark theme.

The prepared runtime set has no Clownfish, Giant Squid, or Megalodon. The playground uses available prepared sprites as clearly labeled prototypes until dedicated art is added. Do not use original white-background concept sheets directly as runtime sprite images; use the prepared atlases and manifest.

## Descent route preview

The **Choose a Sea** screen lists three sample lesson records. Choose **Resume** to open the active instance for that lesson, or **Start new descent** to create another instance with its own ID, player position, and route state. The same-tab selection keeps keyboard input in one app context; browser tabs are not used as lesson instances. The Descent screen starts each selected map at Point Nemo for a new run, then the Explorer moves under **W, A, S, D** control. Reaching the highlighted enemy opens a focused quiz battle overlay above the map, with the lesson part and depth, enemy sprite, Explorer and enemy hull bars, sample question, and answer feedback in one view. The overlay keeps keyboard focus inside the encounter. Incorrect answers reveal the explanation and a clearly marked placeholder for PDF evidence. Answer the sample question, then use **Clear part & continue** to unlock the next marker. Later enemies cannot trigger early. Clearing all three parts unlocks the Goblin Shark prototype boss marker and opens the final boss preview when reached. The preview keeps instances in memory for the current page session only; real resume and attempt history must use the isolated SQLite run records described in [WEB_APP_FLOW.md](WEB_APP_FLOW.md). It does not implement all nine question slots, API calls, Ollama, or SQLite.

Each real uploaded lesson/question set must have its own descent instance and isolated run state. A retry creates another run for that lesson; no progress, route position, answers, or results are shared across different lesson records. See the data and scoring rules in [WEB_APP_FLOW.md](WEB_APP_FLOW.md).

## Visual direction

The playground and main React app share the post-login pixel-ocean finish in `apps/web/src/styles/pixel-ocean.css`. The background uses a seamless 384 × 192 stepped-wave tile and sparse four-pixel water particles. Dark mode uses deep navy, solid blue panels, and teal highlights; light mode uses pale ocean blue, solid pale panels, and dark teal highlights. Panels and controls use crisp borders and offset pixel shadows without decorative glass blur. Pixelify Sans carries headings and short controls; body copy stays in a readable system sans-serif. Navigation scrolls horizontally on narrow screens, while library panels stack. Principal controls have at least 44-pixel tap heights, keyboard focus stays visible, and a stable scrollbar gutter prevents content-width shifts. Existing pixel art remains crisp and visible. Do not add authentication or backend calls to the standalone preview pages.

System reduced-motion preferences freeze decorative sprite animation and suppress hit effects while keeping WASD movement available.

## Run locally

From the repository root in Command Prompt:

```cmd
npm run dev:playground --workspace=@point-nemo/web
```

Open `http://127.0.0.1:5174`. The playground Vite config serves `assets/prepared/runtime` as its public directory.
