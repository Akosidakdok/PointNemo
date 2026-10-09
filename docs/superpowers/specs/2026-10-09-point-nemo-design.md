# Point Nemo Project Setup Design

## Goal

Create a runnable foundation for Point Nemo, a study app that presents course material as a turn-based undersea expedition. The first slice should establish the full-stack architecture and a small playable map and battle example, while leaving lesson ingestion and generated study content ready to connect through defined boundaries.

## Confirmed direction

- Frontend: React, Vite, and TypeScript.
- Backend: Node.js, Express, and TypeScript.
- Local inference: Ollama, with the model configurable rather than fixed before team benchmarking.
- Persistence: SQLite.
- Game: turn-based encounters; map, movement, and visual effects use React and CSS. No dedicated game engine is needed for this 2D scope.
- Study materials may arrive as PDF, DOCX, or PPTX; generated data is validated with Zod before it enters app state or storage.

## Initial deliverable

Set up a single repository with npm workspaces and two applications: `apps/web` and `apps/api`. Provide shared development scripts, environment examples, and a README with prerequisites and local run instructions.

The frontend opens to an expedition map whose route begins at Point Nemo and shows a few illustrative lesson destinations, an iceberg hazard, and a creature encounter. Include a minimal turn-based battle interaction to demonstrate state transitions and CSS feedback. Use local CSS/HTML shapes or placeholders for art until licensed, optimized character assets are supplied; do not generate or download art as part of setup.

The API exposes a health endpoint, initializes a local SQLite database, and defines typed/Zod-validated boundaries for study content, progress, and AI-generated questions. Add service interfaces for document extraction and Ollama generation, but keep upload-to-study generation outside this first slice. The Ollama URL and model name come from environment configuration. The app remains runnable when Ollama is not installed; the AI feature reports an actionable unavailable state when called.

## Architecture and data flow

The browser renders the expedition map and battle state in React. It calls the Express API for health and later study/progress operations. The API owns SQLite access and validates request and generated-content shapes with Zod. Document extraction and Ollama inference sit behind backend service interfaces so libraries and model choices can change without coupling them to the UI. The first version uses local frontend state for its sample map encounter; persistence of gameplay state is not required until lesson/progress flows are implemented.

Suggested structure:

```text
apps/
  web/       React + Vite + TypeScript client
  api/       Express + TypeScript server
packages/
  shared/    Shared Zod schemas and TypeScript types
```

Use npm workspaces at the root. Keep database schema and initialization in the API package. Store secrets and local service configuration in ignored environment files; commit only `.env.example`.

## Visual and game behavior

The map is a responsive React view styled with regular CSS and CSS animations. It communicates the Point Nemo starting position, route progression, hazards, encounters, and lesson destinations without requiring imported art. The sample encounter demonstrates discrete player and enemy turns, health changes, and a short hit/damage animation. Respect reduced-motion preferences and keep controls usable by keyboard.

## Reliability and errors

The API validates inputs at boundaries and returns consistent JSON errors. SQLite initialization is repeatable and local. Missing or unreachable Ollama must not prevent the web app or API from starting. The sample game state should have deterministic initial values so behavior is easy to inspect and extend.

## Verification

The implementation should verify dependency installation, frontend and backend development startup, API health response, database initialization, and a production build. The map and turn interaction should be checked in the browser at desktop and narrow widths, including keyboard access and reduced-motion behavior. Automated tests can cover shared schemas, API health/database initialization, and battle state transitions.

## Out of scope for the first slice

- Full student upload, extraction, and AI-generated study-content workflow.
- Selecting or benchmarking a final local model.
- Production authentication, deployment, multiplayer, or cloud services.
- Finished character illustrations or a large content catalog.
- A full quiz curriculum, battle progression system, or persistence of every game action.
