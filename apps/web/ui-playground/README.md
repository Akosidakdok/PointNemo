# Point Nemo UI playground

An isolated, browser-only page for sketching and reviewing the MVP screens without changing the main app shell or starting the local API. It uses the existing Vite dev server from `apps/web`.

## Run

From the repository root in Command Prompt:

```cmd
npm run dev:playground --workspace=@point-nemo/web
```

Open <http://127.0.0.1:5174>. Stop the server with `Ctrl+C`.

The playground starts at the Local Library, after the wider app's title and login/signup screens. The main React app retains its existing local explorer login/signup and guest entry; the playground does not connect to that identity or replace the post-login screen. Its screens preview the five product modules in `docs/product/WEB_APP_FLOW.md`: Library, Sonar, Choose a Sea, Descent, Lesson Boss, and Results. Choose a Sea is a selection state within the Library module. Profile is a separate top-bar button after the theme control; Leaderboard is a separate extra tab. Both use sample data and are outside the functional MVP.

Vite serves `assets/prepared/runtime`. The Descent map uses `assets/maps/point-nemo-abyss-ocean.png` as its world. The WASD-controlled player uses the prepared transparent Explorer atlas derived from `assets/characters/ocean-explorer-sprite-sheet.png`, with manifest idle/swim sequences, frame rectangles, and anchors. Prepared Barreleye, Gulper, Fringehead, and Goblin Shark atlases provide enemy markers; `water.png` and `effects.png` support the other scenes. A masked `waves.svg` provides blue waves in both light and dark glass themes. The available Goblin Shark is a labeled prototype boss sprite; the runtime set has no Clownfish, Giant Squid, or Megalodon sprite. Reduced-motion preferences freeze decorative animation and suppress hit effects.

Choose a Sea contains sample lesson records. Each **Resume** action loads that lesson's active in-memory preview instance, and **Start new descent** creates a new instance ID with its own map position and route state. The preview is single-tab and memory-only; persistent local runs belong in SQLite in the functional app.

File selection checks only the PDF extension/type. Main's current admission has no upper file-size, page-count, or extracted-character limit and requires at least 300 extracted characters; the preview cannot check text or language. The page does not parse PDFs, call Ollama, score a real run, or save to SQLite. Demo questions, the supporting quote placeholder, results, and saved-run rows are sample content. Use `playground.css` and `playground.js` to iterate quickly; integrate approved components into the main app separately.
