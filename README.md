# Point Nemo

Point Nemo is a local-first study expedition. Students travel from Point Nemo through lesson waypoints, hazards, and turn-based creature encounters while studying course material.

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` and npm. These versions satisfy the Vite 7 engine requirement.
- Ollama is optional for the app and API to start. Install it separately when you are ready to try local generation.

## Run locally

From the repository root:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The Express API listens on port `3001`; Vite proxies `/api` requests to it. The API initializes SQLite on first start at `apps/api/data/point-nemo.sqlite`.

For a production build and TypeScript checks:

```powershell
npm run typecheck
npm run build
```

## Local AI configuration

The checked-in `.env.example` contains local defaults:

```dotenv
API_PORT=3001
DATABASE_PATH=./data/point-nemo.sqlite
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
```

Change `OLLAMA_BASE_URL` or `OLLAMA_MODEL` in your ignored `.env` as needed. `qwen3:4b` is only a starting candidate from the project proposal; benchmark candidate models on the team's hardware before settling on one. The app's Local Intelligence card and `GET /api/ai/status` report whether Ollama is reachable and what to check when it is unavailable.

## What is included

- A responsive React/CSS expedition map with Point Nemo, lesson waypoints, an iceberg hazard, an anglerfish encounter, and a locked lesson-boss waypoint.
- A deterministic turn-based battle example. Activate the encounter node, then use Sonar pulse; the enemy responds automatically. The sample battle is local frontend state and does not save progress.
- An Express health endpoint at `GET /api/health` and an Ollama status endpoint at `GET /api/ai/status`.
- SQLite initialization for subjects, topics, study materials, questions, attempts, and progress.
- Shared Zod schemas for study content, progress, and generated multiple-choice questions. The Ollama service validates generated question data before returning it.
- A document-extraction interface for PDF, DOCX, or PPTX files, ready for parser libraries to be connected.
- An image asset generator and bundled artwork for the explorer, deep-sea creatures, and ocean map.

The first slice does not yet accept uploads, extract documents, expose an AI question-generation endpoint, or persist lesson and battle progress. Those are extension points for the next implementation phase. The bundled artwork is stored under `assets/`; the current map and creature UI still use CSS shapes and symbols, while the battle uses prepared sprite effects for attacks. Track asset sources and licenses when illustrations are added.

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
