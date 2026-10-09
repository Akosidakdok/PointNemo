# Point Nemo Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable full-stack Point Nemo foundation with a React/CSS expedition map, a turn-based encounter, an Express API, SQLite storage, and boundaries for local AI and document parsing.

**Architecture:** Use npm workspaces for `apps/web`, `apps/api`, and `packages/shared`. The web app owns the sample map and battle state; the API owns SQLite, validation, and configurable Ollama/document service adapters. Keep external AI and parsing optional so the app starts without Ollama or uploaded materials.

**Tech Stack:** React, Vite, TypeScript, Node.js, Express, SQLite (`better-sqlite3`), Zod, Ollama HTTP API, CSS.

**Spec:** `docs/superpowers/specs/2026-10-09-point-nemo-design.md`

## Global Constraints

- Frontend: React, Vite, and TypeScript.
- Backend: Node.js, Express, and TypeScript.
- Local inference: Ollama, with the model configurable rather than fixed before team benchmarking.
- Persistence: SQLite.
- Game: turn-based encounters; map, movement, and visual effects use React and CSS. No dedicated game engine is needed for this 2D scope.
- Study materials may arrive as PDF, DOCX, or PPTX; generated data is validated with Zod before it enters app state or storage.
- Missing or unreachable Ollama must not prevent the web app or API from starting.
- Respect reduced-motion preferences and keep controls usable by keyboard.

## Review Focus

- Ollama is missing or unreachable at startup; API and web app still start and AI status explains how to configure it.
- Ollama returns malformed generated JSON; Zod rejects it before persistence.
- SQLite database directory does not exist on first run; initialization creates a usable local database.
- User disables animation or uses keyboard only; the map and battle remain usable.
- API is unreachable from the browser; the UI displays a clear connection state rather than failing silently.

---

### Task 1: Create the npm workspace and shared contracts

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/schemas.ts`

**Interfaces:**
- Produces: `StudyContentSchema`, `ProgressSchema`, and `GeneratedQuestionSchema` Zod exports and their inferred TypeScript types from `@point-nemo/shared`.
- Produces: root `npm run dev`, `npm run build`, and `npm run typecheck` commands. Build order is shared package, API, then web so workspace imports resolve from compiled output.

- [x] Create root npm workspace manifest for `apps/*` and `packages/*`, TypeScript base configuration, and ignore rules for dependencies, build output, local environment files, and SQLite data.
- [x] Define Zod schemas for subject/topic study content, progress records, and generated multiple-choice questions. Require a non-empty prompt, at least two non-empty options, and an integer answer index within the options array.
- [x] Export schema-inferred types from the shared package and add its package export/build configuration.
- [x] Add workspace scripts using `concurrently` for development, sequential TypeScript build scripts for shared → API → web, and a workspace typecheck command. Include `dotenv` for environment-file loading in the API development command.
- [x] Run `npm install` and `npm run typecheck`; expected: lockfile is generated and all workspaces typecheck.

### Task 2: Build the Express API, SQLite initialization, and service boundaries

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/db.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/ai-status.ts`
- Create: `apps/api/src/services/ollama.ts`
- Create: `apps/api/src/services/document-extractor.ts`
- Create: `apps/api/src/errors.ts`

**Interfaces:**
- Consumes: schemas/types exported by `@point-nemo/shared`.
- Produces: `GET /api/health` returning `{ status: "ok" }`; `GET /api/ai/status` returning whether the configured Ollama service is reachable and an actionable message when it is not.
- Produces: `initializeDatabase(path: string): Database` that creates the parent directory and initializes subjects, topics, study materials, questions, attempts, and progress tables idempotently.
- Produces: `OllamaService.generateQuestions(input: StudyContent): Promise<GeneratedQuestion[]>`, validating response data with `GeneratedQuestionSchema` before returning it.
- Produces: `DocumentExtractor.extractText(file: UploadedDocument): Promise<string>` as a typed boundary that clearly reports the parser as not configured in this slice.

- [x] Add API package scripts for development with `tsx` and production compilation with `tsc`; depend on Express, `better-sqlite3`, Zod/shared, and required TypeScript types.
- [x] Implement environment parsing for API port, SQLite file path, Ollama base URL, and model name. Default local database data under an ignored `data/` directory.
- [x] Implement idempotent SQLite setup with foreign keys enabled and tables for subjects, topics, study materials, questions, attempts, and progress.
- [x] Implement Express app construction, JSON error handling, `GET /api/health`, and Vite development proxy compatibility under `/api`.
- [x] Implement Ollama status and generation through the configured local HTTP API. Treat connection failures as service-unavailable errors and validate every generated question before returning it.
- [x] Define the document extraction interface and a typed unavailable error without accepting uploads or adding parser dependencies yet.
- [x] Run `npm run build` and start the API; expected: build succeeds, database initializes on first start, health returns `{ status: "ok" }`, and AI status is actionable when Ollama is absent.

### Task 3: Build the React expedition map and turn-based encounter

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/api.ts`
- Create: `apps/web/src/components/ExpeditionMap.tsx`
- Create: `apps/web/src/components/BattleEncounter.tsx`
- Create: `apps/web/src/game/battleState.ts`
- Create: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `/api/health` and `/api/ai/status` from Task 2.
- Produces: map route that begins at Point Nemo and renders illustrative lesson destinations, one iceberg hazard, one creature encounter, and a lesson boss node.
- Produces: deterministic battle reducer with `BattleState`, `BattleAction`, and `battleReducer(state, action): BattleState`; player and enemy actions alternate, health never drops below zero, and a defeated enemy ends the encounter.

- [x] Add React/Vite/TypeScript app config and a Vite `/api` proxy to the Express development port.
- [x] Implement API status loading and visible loading/unavailable states without making API unavailability block map rendering.
- [x] Implement responsive Point Nemo route map with selectable destinations, hazard and encounter markers, and CSS/HTML placeholder creatures.
- [x] Implement deterministic battle reducer and controls for a player move and enemy response; display both health values, current turn, and encounter outcome.
- [x] Add CSS for deep-sea atmosphere, map route progression, movement/hit feedback, and restrained bioluminescent effects; disable nonessential animation for `prefers-reduced-motion: reduce`.
- [x] Verify browser interaction at desktop and narrow widths, with keyboard navigation; confirm the reduced-motion media rule is present. Expected: map remains readable, nodes/buttons are operable, and battle turns resolve visibly.

### Task 4: Document local development and verify the complete setup

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: root scripts, `.env.example`, API routes, and frontend entry point from Tasks 1–3.
- Produces: reproducible local setup, run, build, and Ollama configuration instructions.

- [x] Document prerequisites, `npm install`, copying `.env.example`, `npm run dev`, `npm run build`, and how to configure Ollama/model settings.
- [x] Document that document upload/parsing and generated study-content flows are extension points rather than completed features.
- [x] Run `npm run typecheck` and `npm run build`; expected: both complete successfully across workspaces.
- [x] Run the API and web app together and manually confirm map render, battle turn flow, API health, SQLite initialization, and the missing-Ollama message.
