# Point Nemo: Engineering & Test Evidence Log

**Date:** October 10, 2026  
**Operating System:** Windows  
**Runtime:** Node.js v25.2.1, npm 11.6.0  
**Inference Engine:** Local Ollama (`http://127.0.0.1:11434`, zero cloud API dependencies)  
**Storage:** SQLite via `better-sqlite3` with transactional migrations  

---

## 1. Local Runtime & Inference Disclosure

Point Nemo executes all extraction, prompt generation, validation, and game loop mechanics locally on the user's laptop.
- **Model Target:** Local Ollama (`qwen2.5:1.5b`).
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

### B. Unit & Integration Tests
Command: `npm test`
- **Asset & Schema Tests:** 37/37 passed.
- **API & Game Run Tests:** 50/50 passed (admission limits, transactional commits, cascading deletion, 18-slot progression, idempotent retries).
- **Web UI & Adapter Tests:** 31/31 passed (Zustand state isolation, error propagation, evidence viewer, SPA navigation).
- Result: **118/118 passing tests**.

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
- Result: **All route smoke steps passed**.

### D. Production Builds
Command: `npm run build`
- `@point-nemo/shared`: build succeeded.
- `@point-nemo/api`: build succeeded.
- `@point-nemo/web`: Vite production bundle generated without errors (`dist/index.html`, `dist/assets/index-*.css`, `dist/assets/index-*.js`).

---

## 3. Acceptance Gate Status Disclosure

In accordance with project rules, all release gates are recorded truthfully against this release build:

| Gate | Status | Evidence / Details |
| :--- | :--- | :--- |
| **A1 — Rules/team** | Confirmed | Official cutoff confirmed: October 10, 2026, 10:00 AM (Asia/Manila). Team: Team Point Nemo. Onsite Presenter: Mark Vasquez. |
| **A2 — Setup** | Verified | Clean build across shared, api, and web. Production Express server starts on documented port 3000 serving built Vite SPA with deep SPA link fallback. Database initialized in external AppData (`%LOCALAPPDATA%\PointNemo`). |
| **A3 — Fresh offline AI** | Verified | Tested against local Ollama (`qwen2.5:1.5b`) on loopback (`http://127.0.0.1:11434`). Generated full 9-question question set with state `ready` and `compatible: true` without cloud or external network calls. |
| **A4 — Failures** | Verified | Automated checks verify PDF signature checks, 5 MiB / 3-page / 8,000-char limits, 90s job timeout, 40s inference timeout, idempotent cancel, and cascading deletion. |
| **A5 — Fidelity/isolation** | Verified | Automated tests and manual probe inspection verify exact verbatim quotes matching cited page chunk text. Multi-document isolation tests confirm unseen documents never reuse demo questions. |
| **A6 — Game integrity** | Verified | Complete 18-slot combat lifecycle verified: Zone 2/3 pass, 1/3 fail; Boss 8/9 pass, 7/9 fail; idempotent identical answer re-submission; 409 conflict on out-of-order answers; transactional attempt commits. |
| **A7 — Performance** | Verified | Empirical hardware measurements logged in `docs/benchmark.md`: Golden path completes in **24.08 seconds** (exceeding the $\le 30$ second target) on NVIDIA GeForce RTX 4050 Laptop GPU. |
| **A8 — Demo/submission** | Ready for delivery | Public repo prepared for push to branch. Video recording, social hashtag post (`#AppbuildersPH`), and form submission receipt assigned to Delivery owner (Mark Vasquez). |
