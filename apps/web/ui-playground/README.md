# Point Nemo UI playground

An isolated, browser-only page for sketching and reviewing the MVP screens without changing the main app shell or starting the local API. It uses the existing Vite dev server from `apps/web`.

## Run

From the repository root in Command Prompt:

```cmd
npm run dev:playground --workspace=@point-nemo/web
```

Open <http://127.0.0.1:5174>. Stop the server with `Ctrl+C`.

The playground starts at the Local Library, after the wider app's title and login/signup screens. Those entry screens and account behavior are outside this playground and the functional MVP. The five main tabs preview the product modules in `docs/product/WEB_APP_FLOW.md`: Library, Sonar, Descent, Point Nemo, and Results. Profile is a separate top-bar button after the theme control; Leaderboard is a separate extra tab. Both use sample data and are outside the functional MVP.

Vite serves `assets/prepared/runtime`; the playground uses the existing sprite loader with the explorer, Barreleye, Goblin shark, water, and combat-effect atlases. These atlases are prepared from the source sheets under `assets/characters`, `assets/enemies`, and `assets/effects`. A masked `waves.svg` provides blue waves in both light and dark glass themes. The Boss preview uses the available Goblin shark sprite as a clearly labeled Megalodon art placeholder. No Clownfish sprite is available yet, so the Surface encounter icon is a CSS placeholder.

File selection checks only the PDF extension/type and the 5 MiB size limit. The page does not parse PDFs, call Ollama, score a real run, or save to SQLite. Demo questions, the supporting quote placeholder, and saved-run rows are sample content. Use `playground.css` and `playground.js` to iterate quickly; move approved components into the main app deliberately.
