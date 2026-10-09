# Point Nemo: Architecture, Runtime & Development Disclosure

**Date:** October 10, 2026  
**Project:** Point Nemo — Offline Desktop Ocean Descent Study Battle  
**Release Tag / Target:** Hackathon Freeze Target (October 10, 2026, 10:00 AM Asia/Manila)  

---

## 1. Local Runtime Architecture & Privacy Boundary

Point Nemo is an offline-first learning system engineered to run completely on a student's personal laptop without external network connectivity or cloud AI dependencies.

- **Frontend:** React 19, TypeScript, Vite SPA, Tailwind CSS / custom retro aesthetic. State managed via Zustand.
- **Backend Server:** Node.js v25.2.1, Express 5, bound strictly to loopback (`127.0.0.1:3000`). Local origin verification enforced on all mutating HTTP routes.
- **Document Ingestion:** Native streaming multipart PDF parser enforcing RFC 2046 and strict PDF signature validation (`%PDF-1.x`). Raw PDF byte buffers are processed in-memory and immediately zeroed/discarded after extraction; raw files are never retained on disk.
- **Document Pipeline:** `pdf-parse` (v2.4.5) with in-process async text and structure extraction, enforcing a 3-page limit, 5 MiB maximum file size, 8,000 maximum normalized characters, and minimum 300 non-whitespace English characters.
- **Token Budgeting & Normalization:** Pinned local byte-level BPE tokenizer (`assets/tokenizer/qwen2.5-tokenizer.json`, digest: `d9011691d2d6b47762206b71f4a78429b5614850725b47ae06bef96674eed416`) matching Qwen2.5 tokenization. Hard token budget checked before inference (limit: 4,096 input tokens, 3,072 max output tokens within `num_ctx: 8192`).
- **Inference Engine:** Local Ollama daemon running on loopback (`http://127.0.0.1:11434`), pinned strictly to `qwen2.5:1.5b`. Zero external network calls or cloud API gateways.
- **Database & Persistence:** SQLite via `better-sqlite3` located outside the repository in the user's local application data directory (`%LOCALAPPDATA%\PointNemo\point-nemo.sqlite` on Windows). Transactional migrations, strict foreign key cascading, and atomic run slot progression.
- **Combat & Scoring Engine:** Server-authoritative deterministic combat progression across 18 fixed question slots (3 Surface, 3 Twilight, 3 Midnight, 9 Point Nemo Boss review). Zero LLM inference during active gameplay.

---

## 2. Cloud AI & External Dependencies Disclosure

- **Runtime Cloud Inference:** **NONE (0%)**. All LLM inference, embedding, scoring, and storage run 100% locally.
- **Remote Network Calls:** None during application runtime. No telemetry, analytics, remote licensing checks, or CDN asset links.
- **Development Tooling Disclosure:**
  - AI Coding Assistant: Google DeepMind Antigravity / Claude Code used during development for scaffolding, testing, refactoring, and benchmark automation.
  - Runtime Dependencies: Listed with exact versions in `package.json` across workspaces (`@point-nemo/shared`, `@point-nemo/api`, `@point-nemo/web`).

---

## 3. Supported Input Limits & Known Operational Constraints

- **Document Format:** English text-based PDF documents only. Scanned images, figures, and drawing-only PDFs are rejected at admission (`UNUSABLE_PAGE_TEXT` / `IMAGE_DEPENDENT_PDF`).
- **File Size:** Maximum 5 MiB (5,242,880 bytes).
- **Page Count:** Maximum 3 pages.
- **Text Length:** Minimum 300 non-whitespace characters; maximum 8,000 normalized NFC characters.
- **Language:** English text (minimum 80% Latin alphabetic characters).
- **Concurrency:** Single-user local desktop application. One document generation job allowed at a time (`GENERATION_BUSY` 429 response if concurrent upload attempted).
