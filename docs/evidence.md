# Point Nemo: Engineering & Test Evidence Log

**Date:** October 10, 2026  
**Operating System:** Windows  
**Runtime:** Node.js v25.2.1, npm 11.6.0  
**Inference Engine:** Local Ollama (`http://127.0.0.1:11434`, zero cloud API dependencies)  
**Storage:** SQLite via `better-sqlite3` with transactional migrations  

---

## 1. Local Runtime & Inference Disclosure

Point Nemo executes all extraction, prompt generation, validation, and game loop mechanics locally on the user's laptop.
- **Model Target:** Local Ollama (`qwen2.5:1.5b` / `qwen3:4b`).
- **Cloud Dependencies:** Zero runtime cloud AI, remote inference, or cloud database services.
- **Privacy Boundary:** Document bytes are processed in memory; normalized text, chunks, question sets, and run slots are stored strictly in local SQLite.

---

## 2. Executed Implementation Checks

The following automated test suites and validation scripts were executed directly in this environment:

### A. TypeScript Typecheck
Command: `npm run typecheck`
- `@point-nemo/shared`: `tsc -b` passed.
- `@point-nemo/api`: `tsc -p tsconfig.json --noEmit` passed.
- `@point-nemo/web`: `tsc -b --pretty false` passed.
- Result: **0 type errors**.

### B. Unit & Service Tests
Command: `npm test`
- **Asset Tests:** 22/22 passed.
- **API & Game Run Tests:** 14/14 passed:
  1. `run creation from a ready question set`: Creates run with 18 fixed slots, HP 100/100, XP 0, combo 0, and masked active question (no leaked answer, explanation, or evidence).
  2. `fixed 18-slot ordering`: Verifies exact structure (3 easy in Surface, 3 medium in Twilight, 3 hard in Midnight, 9 boss review questions in saved order).
  3. `correct and incorrect answers calculate HP, combo, XP, and damage`: Verifies +50 enemy damage and +10 XP on correct; -50 player damage and combo reset on wrong.
  4. `duplicate identical retry idempotence`: Confirms identical answer re-submission returns original feedback without awarding XP or damage twice.
  5. `changed answer conflict`: Confirms submission of a different option index on an answered slot throws `ANSWER_CONFLICT` (HTTP 409).
  6. `out-of-order answer conflict`: Confirms out-of-sequence slot submissions throw `OUT_OF_ORDER` (HTTP 409).
  7. `boss 8/9 pass and run completion`: Verifies that 8/9 correct in the Megalodon boss round completes the run with status `completed`.
  8. `boss 7/9 fail ends run in failed state`: Verifies that 7/9 correct in the Megalodon boss round ends the run with status `failed`.
  9. `transaction rollback on invalid answers`: Confirms invalid option index (-1, 5) aborts without inserting attempt or advancing slot index.
  10. `restart/read persistence from SQLite`: Closes SQLite connection and verifies all run state, slot order, and attempts persist across database re-open.
  11. `LocalPdfExtractor admits the networking fixture`: Validates extraction, character boundaries, and SHA-256 calculation.
  12. `valid model output is persisted as one complete question set`: Validates 3-topic/9-question relational persistence.
  13. `invalid model output fails closed without persisting a question set`: Validates schema and evidence quote constraint rejection.
  14. `runs HTTP API endpoints: create, get, answer, and error contracts`: Tests HTTP endpoints on an ephemeral loopback listener.

### C. End-to-End Route Smoke Test
Command: `npm run test:smoke` (`scripts/smoke-test.ts`)
- `GET /api/health` -> HTTP 200 `status: ok`
- `POST /api/documents` -> HTTP 202 (job queued)
- `GET /api/jobs/:id` -> HTTP 200 polling until `ready`
- `GET /api/question-sets/:id` -> HTTP 200 (3 topics, 9 questions retrieved)
- `POST /api/runs` -> HTTP 201 (authoritative run created, slot 0 ready)
- `GET /api/runs/:id` -> HTTP 200 (authoritative state retrieved)
- `POST /api/runs/:id/answers` -> HTTP 200 (correct answer recorded, HP and XP updated, evidence quote returned)
- Identical retry on slot 0 -> HTTP 200 (idempotent, no double damage or XP)
- Result: **All smoke steps passed**.

### D. Production Builds
Command: `npm run build`
- `@point-nemo/shared`: build succeeded.
- `@point-nemo/api`: build succeeded.
- `@point-nemo/web`: Vite production bundle generated without errors (`dist/index.html`, `dist/assets/index-*.css`, `dist/assets/index-*.js`).

---

## 3. Acceptance Gate Status Disclosure

In accordance with project rules, gates A3–A8 are not claimed as passed until live offline hardware verification is executed on the target demo laptop:

| Gate | Status | Evidence / Blocker |
| --- | --- | --- |
| **A1 — Rules/team** | Pending | Roster and official deadline confirmation pending project owner. |
| **A2 — Setup** | Verified in repo | Node build, SQLite migrations, and test runner verified. Ollama daemon not running during headless CI test pass. |
| **A3 — Fresh offline AI** | Pending live test | Local inference pipeline and schemas implemented and tested against mocks; real live Ollama model generation pending execution with external networking disabled. |
| **A4 — Failures** | Verified in test suite | Schema rejections, PDF limits, slot order conflicts, invalid option indices, and idempotent retries verified. |
| **A5 — Fidelity/isolation** | Partially verified | Exact quote and chunk mapping verified via tests; manual inspection of real AI-generated demo notes pending live generation. |
| **A6 — Game integrity** | Verified in test suite | 18 fixed slots, stage boundaries (2/3 zone pass, 8/9 boss pass, 7/9 boss fail), HP/XP calculations, and persistence verified. |
| **A7 — Performance** | Pending live measurements | 30-second target from admission to playable screen pending hardware benchmark with live local Ollama model. |
| **A8 — Demo/submission** | Pending | Rehearsal, recording, and submission pending demo day schedule. |
