# Point Nemo

Point Nemo is a local-first study expedition. Students travel from Point Nemo through depth zones and turn-based creature encounters while studying course material extracted from their uploaded documents.

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` and npm. These versions satisfy the Vite 7 engine requirement.
- **Local Ollama** (default `http://127.0.0.1:11434` with configured model, e.g. `qwen2.5:1.5b` or `qwen3:4b`). All runtime inference is strictly local Ollama with zero cloud API dependencies. Ollama is optional for the app and API to start; mock and deterministic validation flows are supported without an active Ollama instance.

## Run locally

From the repository root:

```cmd
npm install
copy .env.example .env
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The Express API listens on port `3001`; Vite proxies `/api` requests to it. The API initializes SQLite on first start at `apps/api/data/point-nemo.sqlite`.

To verify the codebase, run TypeScript typechecks, tests, smoke tests, and build:

```cmd
npm run typecheck
npm test
npm run test:smoke
npm run build
```

### Standalone UI playground

```cmd
npm run dev:playground --workspace=@point-nemo/web
```

Open [http://127.0.0.1:5174](http://127.0.0.1:5174). This separate preview starts at Local Library and uses sample lessons, in-memory descent instances, and sample Profile/Leaderboard pages. It does not call the API, process PDFs, authenticate users, or persist progress. The main React app retains its local explorer login/signup and guest entry. See [the playground handoff](docs/product/UI_PLAYGROUND_HANDOFF.md) for scope and integration boundaries.

## Local AI configuration

The checked-in `.env.example` contains local defaults:

```dotenv
API_PORT=3001
DATABASE_PATH=./data/point-nemo.sqlite
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
```

Change `OLLAMA_BASE_URL` or `OLLAMA_MODEL` in your `.env` as needed. All inference calls are dispatched to your local Ollama loopback host. No document text, prompts, or answers are ever sent to remote or cloud AI endpoints.

## What is included

- **Local Document Intake**: Accepts text-based PDFs with at least 300 extracted characters; current admission has no upper file-size, page-count, or extracted-character limit. `POST /api/documents` admits the file, `GET /api/jobs/:id` reports bounded job status, and `GET /api/question-sets/:id` returns the persisted 3-topic/9-question set with source evidence.
- **Authoritative Game Run Backend**:
  - `POST /api/runs`: Creates an authoritative run from a ready question set with 18 fixed, persisted slots.
    - 3 easy questions (Surface: Clownfish)
    - 3 medium questions (Twilight: Anglerfish)
    - 3 hard questions (Midnight: Giant Squid)
    - 9 boss review questions (Point Nemo: Megalodon, reusing all 9 questions in a saved shuffled order)
  - `GET /api/runs/:id`: Returns authoritative player HP, encounter HP, XP, combo, current slot index, and active masked question (omits answers and explanations until submitted).
  - `POST /api/runs/:id/answers`: Transactionally validates and records answers.
    - Resolves stage boundaries: Surface, Twilight, and Midnight require at least 2/3 correct; Boss requires 8/9 correct (7/9 fails).
    - Idempotent: Retrying the identical answer returns stored feedback without awarding double XP or damage.
    - Strict validation: Rejects out-of-order answers, changed answers for answered slots, and invalid option indices.
- **Connected Web Interface**:
  - Retro Submersible UI with 2D Ocean Viewport (`OceanCanvas`), `LocalLibrary`, `UploadDialog`, 3-stage `SonarProcessing` (`extracting` -> `generating` -> `validating` -> `ready`), 16-bit `DescentEncounter` combat canvas, and `ResultsScreen`.
  - Classic Expedition Map dashboard view with interactive waypoints, battle card, and document intake.
  - "Begin descent run" starts the authoritative game run via the API.
  - Authoritative combat interface displays creature threats, depth zones, live player HP and enemy HP bars, XP, combo, question options, feedback explanations, and source-text quotes with page numbers.
  - Automatic resume: Saved runs continue seamlessly across page refreshes.
  - Results screen with "Descent Complete" badge upon boss victory, or mistake review with supporting source evidence upon failure.
- **Offline & Local Architecture**: SQLite via `better-sqlite3` with transactional migrations, Zod schema validation across backend and web client, and full offline test coverage.
- **Art and asset generation**: Bundled image sheets, prompts, and asset-generation CLI documented in [the asset guide](docs/assets/README.md).
- **Web App Flow Documentation**: The learner journey and system architecture are documented in [docs/product/WEB_APP_FLOW.md](docs/product/WEB_APP_FLOW.md) and [point-nemo-masterplan.md](point-nemo-masterplan.md).

## Repository layout

```text
apps/
  api/       Express API, SQLite setup, Ollama, document intake, and game run services
  web/       React/Vite study expedition interface and authoritative battle view
packages/
  shared/    Zod schemas and TypeScript types for documents, jobs, and game runs
fixtures/    PDF test documents and expected question sets
```
