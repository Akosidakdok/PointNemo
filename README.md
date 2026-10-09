# Point Nemo

Point Nemo is a local-first study expedition. Students travel from Point Nemo through lesson waypoints, hazards, and turn-based creature encounters while studying course material.

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` and npm. These versions satisfy the Vite 7 engine requirement.
- Ollama is optional for the app and API to start. Install it separately when you are ready to try local generation.

## Run locally

From the repository root:

```cmd
npm install
copy .env.example .env
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The Express API listens on port `3001`; Vite proxies `/api` requests to it. By default, SQLite is initialized in the user's local app-data directory. Set `DATABASE_PATH` in `.env` only to override that location.

### UI playground

For isolated UI mockups that do not need the API, open Command Prompt at the repository root and run:

```cmd
npm run dev:playground --workspace=@point-nemo/web
```

Then open [http://127.0.0.1:5174](http://127.0.0.1:5174). The starter page previews the five MVP screens; PDF extraction, Ollama, game scoring, and SQLite are not connected. See [`apps/web/ui-playground/README.md`](apps/web/ui-playground/README.md) for details. Stop the server with `Ctrl+C`.

For a production build and TypeScript checks:

```cmd
npm run typecheck
npm run build
```

## Local AI configuration

The checked-in `.env.example` contains local defaults:

```dotenv
API_PORT=3001
# DATABASE_PATH=./data/point-nemo.sqlite
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
```

Change `OLLAMA_BASE_URL` or `OLLAMA_MODEL` in your ignored `.env` as needed. The API reports whether Ollama and the configured model are ready at `GET /api/ai/status`.

## What is included

- A responsive React/CSS expedition map with Point Nemo, lesson waypoints, an iceberg hazard, an anglerfish encounter, and a locked lesson-boss waypoint.
- A deterministic turn-based battle example. Activate the encounter node, then use Sonar pulse; the enemy responds automatically. The sample battle is local frontend state and does not save progress.
- Express endpoints for PDF admission, extraction/generation jobs, cancellation/retry, local document listing/deletion, run resume, and answer scoring. Route contracts are documented in [`docs/api/LOCAL_API.md`](docs/api/LOCAL_API.md).
- SQLite storage for extracted pages, validated question sets, job state, run slots, attempts, feedback, scores, and badges, alongside the existing starter tables.
- Local PDF text extraction and Ollama generation for exactly nine source-grounded questions, with bounded repair and evidence checks.
- Shared Zod schemas for existing study content and the nine-question MVP set.
- An image asset generator and bundled artwork for the explorer, deep-sea creatures, and ocean map.

The API modules are available for local integration, but the main web app still shows the earlier expedition shell and does not yet use the new endpoints. The isolated [`apps/web/ui-playground`](apps/web/ui-playground/README.md) previews the MVP screens with sample content. End-to-end flow, scoring, persistence, offline behavior, and model quality still need implementation evidence. The bundled artwork is stored under `assets/`; the current map and creature UI still use CSS shapes and symbols, while the battle uses prepared sprite effects for attacks. Track asset sources and licenses when illustrations are added.

## Art and asset generation

The bundled image sheets, prompts, and asset-generation CLI are documented in [the asset guide](docs/assets/README.md). The CLI uses a local `.env` file for `OPENAI_API_KEY`; it does not add image-generation calls to the running app.

The proposed learner journey, local AI assurance gates, navigation, and team boundaries are in the [web app flow handoff](docs/product/WEB_APP_FLOW.md).

## Repository layout

```text
apps/
  api/       Express API, SQLite setup, Ollama and document service boundaries
  web/       React/Vite study expedition interface
packages/
  shared/    Zod schemas and shared TypeScript types
```
