# Point Nemo UI playground

An isolated, browser-only page for sketching and reviewing the MVP screens without changing the main app shell or starting the local API. It uses the existing Vite dev server from `apps/web`.

## Run

From the repository root in Command Prompt:

```cmd
npm run dev:playground --workspace=@point-nemo/web
```

Open <http://127.0.0.1:5174>. Stop the server with `Ctrl+C`.

The playground starts at the Local Library, after the wider app's title and login/signup screens. Those entry screens and account behavior are outside this playground and the functional MVP. Its screens preview the five product modules in `docs/product/WEB_APP_FLOW.md`: Library, Sonar, Choose a Sea, Descent, Lesson Boss, and Results. Choose a Sea is a selection state within the Library module. Profile is a separate top-bar button after the theme control; Leaderboard is a separate extra tab. Both use sample data and are outside the functional MVP.

Vite serves `assets/prepared/runtime`. The Descent map uses `assets/maps/point-nemo-abyss-ocean.png` as its world and `assets/characters/ocean-explorer-sprite-sheet.png` as the WASD-controlled player. The player sheet is split into four direction rows with three swim frames and its white background is removed by the browser renderer. Prepared Barreleye, Gulper, Fringehead, and Goblin Shark atlases provide enemy markers; `water.png` and `effects.png` support the other scenes. A masked `waves.svg` provides blue waves in both light and dark glass themes. The available Goblin Shark is a labeled prototype boss sprite; the runtime set has no Clownfish, Giant Squid, or Megalodon sprite.

Choose a Sea contains sample lesson records. Each **Resume** action loads that lesson's active in-memory preview instance, and **Start new descent** creates a new instance ID with its own map position and route state. The preview is single-tab and memory-only; persistent local runs belong in SQLite in the functional app.

File selection checks only the PDF extension/type and the 5 MiB size limit. The page does not parse PDFs, call Ollama, score a real run, or save to SQLite. Demo questions, the supporting quote placeholder, and saved-run rows are sample content. Use `playground.css` and `playground.js` to iterate quickly; move approved components into the main app deliberately.
