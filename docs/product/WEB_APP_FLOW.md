# Point Nemo — Hackathon MVP Web App Flow

**Audience:** Product, UX, frontend, backend, QA, and local AI teams
**Scope:** Strict single-device hackathon MVP, aligned to `point-nemo-masterplan.md`
**Product promise:** Turn one short English PDF into a source-grounded, replayable ocean descent using local processing and local storage.

## MVP boundaries

- One learner on one laptop. No sign-up, log-in, profile switching, or account recovery.
- One PDF per document and generation run; learners may keep multiple independent document records in the local library. Never combine documents into one generated set. No cloud upload, cloud inference, cloud sync, or multi-device service.
- Runtime inference uses local Ollama with `qwen2.5:1.5b`. After setup and model download, the study flow works without internet access.
- Persist validated source material, generated questions, attempts, and run progression in local SQLite. The source PDF itself is handled in memory during extraction and is not retained by default.
- The only study experience in scope is the three-zone descent followed by its boss review. Expedition maps, standalone review or flashcard modes, leaderboards, and broad dashboard routing are deferred.

## Product module map

The wider web app places a title screen and then a login/signup page before this experience. This flow and the UI playground start after those entry screens, at Module 1: Local Library. The title and login/signup screens are not represented in the playground. Login, signup, account state, and authentication remain outside the functional hackathon MVP; they are not part of the local study flow.

| Module | Screens and responsibilities | Leads to |
| --- | --- | --- |
| **1. Local Library & Document Intake** | Upload and validate one PDF; show saved local materials, active run, and attempts | Module 2 after a document is accepted |
| **2. Sonar / Local AI Processing** | Show extraction, question generation, validation, bounded repair, and actionable failures | Module 3 only after all 9 questions pass validation |
| **3. Ocean Descent** | Run Surface, Twilight, and Midnight encounters; handle answers, HP, XP, and source-backed feedback | Module 4 after passing all three zones; Module 5 after a failed zone |
| **4. Point Nemo Boss Review** | Replay the same 9 questions in the saved shuffled order and check the 8/9 threshold | Module 5 on pass or fail |
| **5. Results & Saved Progress** | Show outcome, mistakes, retry, and resume state persisted locally in SQLite | Module 1 or resume the saved run |

These are learner-facing product modules. They describe screen ownership and transitions, not required source-code package boundaries.

## Additional playground previews outside MVP

The frontend playground also has standalone Profile and Leaderboard pages for visual review. They use sample data and are not part of the functional five-module MVP: Profile is a top-bar shortcut, and Leaderboard is an extra preview tab. Neither page implies authentication, cloud data, or an online leaderboard. The MVP exclusions above remain in force unless product scope is deliberately revised.

## Linear user journey

The diagram starts at the MVP entry point, after any wider-app login/signup page.

```mermaid
flowchart LR
    A[1. Local library] --> B[Choose one English text-based PDF]
    B --> C{File within limits and readable?}
    C -- No --> D[Explain limit or extraction issue]
    D --> A
    C -- Yes --> E[2. Sonar: Extraction]
    E --> F[Sonar: Generation with local Ollama]
    F --> G[Sonar: Validation]
    G --> H{Exactly 9 questions valid and source-grounded?}
    H -- No --> I[Show specific error and bounded retry]
    I --> A
    H -- Yes --> J[3. Surface: Clownfish, 3 Easy]
    J -->|2 of 3 correct| K[Twilight: Anglerfish, 3 Medium]
    K -->|2 of 3 correct| L[Midnight: Giant Squid, 3 Hard]
    L -->|2 of 3 correct| M[4. Point Nemo: Megalodon, shuffled 9-question review]
    J -->|Fail| N[5. Results: mistakes, save, retry]
    K -->|Fail| N
    L -->|Fail| N
    M -->|8 of 9 correct| O[Descent Complete badge]
    M -->|Fail| N
    O --> P[Save result and progression to local SQLite]
    N --> P
```

### 1. Library & Document Upload

The app opens directly to a local library screen. There are no account screens or general-purpose dashboard. The primary action is **Upload PDF**; the library lists independent local document records, compatible saved question sets, the active run, and past attempts. Only one generation job may run at a time.

Accept one English, text-based PDF per run with these strict limits:

| Admission rule | MVP limit |
| --- | --- |
| File count | One PDF per document and generation run; different PDFs remain isolated |
| File size | Under 5 MiB |
| Pages | No more than 3 pages |
| Extracted text | No more than 8,000 normalized characters and at least 300 non-whitespace characters |
| Language/content | English text that can be extracted and tied to page-level source locations |
| Unsupported input | Scanned/image-only, encrypted, unreadable, empty, or out-of-limit PDF |

Validate before generation and show a specific, actionable reason when a file is rejected. Require usable text on each nonblank content page; figures and tables are not interpreted. Do not add OCR or silently truncate content. Keep uploaded PDF bytes in memory for extraction, then release them. Store normalized extracted pages and source passages needed for questions and feedback; do not retain the original PDF by default. A library record represents this saved extracted material and its generated data, not an archived copy of the uploaded file.

Uploading a PDF requests fresh generation. Reusing a saved question set is a separate, explicit action and is available only for the same document hash with compatible extraction, model, tokenizer, generation settings, prompt/schema, and game-rules versions. Label reused content **Saved questions** and show its creation time; never present it as fresh inference.

### 2. Local AI Processing (Sonar Loading)

After admission, show a real three-stage loading view. Each stage changes only when that work actually starts or completes; do not show a fabricated percentage. Include elapsed time, a cancel action, and a clear error/retry path.

| Visible state | Work performed | Completion condition |
| --- | --- | --- |
| **Extraction** | Parse the admitted PDF locally and retain page locations with normalized text | Text passes the character/content limits and source locations are available |
| **Generation** | Send only this document's extracted text and generation instructions to local Ollama using `qwen2.5:1.5b` | Model returns 3 distinct topics and 9 questions: one Easy, one Medium, and one Hard question per topic |
| **Validation** | Validate structure, exact count, topic/difficulty coverage, answer key, explanation, and source evidence | Exactly 9 questions pass checks; each has a defensible answer and an exact supporting PDF quote/page |

The final question set contains exactly 9 source-grounded questions: 3 distinct topics × 3 difficulty levels. A schema-valid response alone is not sufficient: reject unsupported claims, missing/incorrect quotes, ambiguous answer keys, duplicates, or malformed questions. Allow at most one bounded model repair attempt per job using validation feedback. If that fails, offer **Retry generation** as an explicit user action using the saved extracted text; each retry starts a new job with the same limits, and retries are never automatic. Extraction failures require the learner to select the PDF again. A cancelled job cannot commit later. If validation still fails, report the failure and return the learner to the library without starting a run.

All nine questions are generated and validated before a run starts. Do not call the model during combat; question order and feedback evidence come from the saved question set.

### 3. The Ocean Descent (Game Phase)

The validated set is played in fixed order through three depth zones. Each zone begins with **100 player HP**, **100 enemy HP**, and combo 0. Each zone contains exactly one question from each of the three topics at its assigned difficulty. The player answers all 3 questions in a zone before the zone outcome is resolved, even if an HP bar reaches zero partway through. This preserves fixed question counts and makes the 2/3 threshold determine the encounter outcome.

| Depth zone | Enemy | Difficulty | Questions | Player HP at start | Enemy HP at start | Pass condition |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Surface | Clownfish | Easy; one per topic | 3 | 100 | 100 | At least 2/3 correct |
| Twilight | Anglerfish | Medium; one per topic | 3 | 100 | 100 | At least 2/3 correct |
| Midnight | Giant Squid | Hard; one per topic | 3 | 100 | 100 | At least 2/3 correct |

Resolve each answer immediately, then let the player continue to the next question:

| Answer | Encounter effect | Feedback shown |
| --- | --- | --- |
| Correct in a depth zone | Deal 50 damage to the enemy and award 10 XP | Mark correct and show a concise explanation with its source |
| Incorrect | Deal 50 damage to the player | Immediately reveal the correct answer, explanation, and exact supporting PDF quote with page number |

Present every question in the fixed round. At the end of the three answers, pass the player to the next zone if they met its threshold; otherwise end the run and open Results. On a passed zone, reset player and enemy HP to 100 and combo to 0 for the next zone while preserving run XP and attempts. Keep the question, answer, feedback, and source passage connected so the player can inspect why an answer was correct.

### 4. The Boss Review (Point Nemo)

After the player passes Surface, Twilight, and Midnight, start the Megalodon encounter at Point Nemo. This is labeled **Mixed-topic review: previously encountered questions**. It contains the exact same 9 questions from the descent, shuffled into a saved order; it does not generate new questions.

| Boss | Questions | Player HP at start | Enemy HP at start | Correct answer | Pass condition |
| --- | --- | ---: | ---: | --- | --- |
| Megalodon | All 9 descent questions exactly once, 3 per topic, in a saved shuffled order | 100 | 80 | Deal 10 enemy damage and award 10 XP | At least 8/9 correct; 7/9 or fewer fails |

The boss stage starts with 100 player HP and combo 0. A wrong answer deals 50 player damage, resets combo, and reveals the correct answer, explanation, and exact quote/page. Present all nine questions before resolving the result, even if an HP bar reaches zero. Boss correct answers deal 10 enemy damage and award 10 XP; these are practice repeats and do not create new questions or additional unique-topic mastery. Keep the shuffled order with the run so refresh/resume continues the same encounter.

### 5. Results & Saved Progress

On a boss pass, award a **Descent Complete** badge tied to that run. The badge records completion; it is not a certification or a claim of mastery. Results show the Surface, Twilight, Midnight, and boss scores; the nine unique questions versus eighteen total answer slots; missed topics; and the source-backed mistakes for review.

Failing any zone or the boss ends the run. Results show the failed threshold, mistakes, correct answers, explanations, and exact PDF quotes. **Try again** starts a new run from the same validated question set with XP reset to zero; keep the failed run in attempt history.

Save the run and progression locally in SQLite, including the validated question set, run status, stage, question order, current slot, HP, combo, XP, accepted answers, feedback, and results. On reopening the app, offer **Resume run** for the active run and restore its saved state and order, provided its game-rules version is still supported. An identical answer retry returns the original feedback and state without applying damage or XP again; changed answers and out-of-order submissions are rejected. **Try again** creates a separate run from the same compatible validated set with XP reset to zero; prior attempts remain in history. Completed and failed attempts remain in the local library until the learner deletes that document. Deleting a document cancels related work and transactionally removes its extracted material, question sets, runs, attempts, progress, and run-tied badges; an active run closes. This is same-device persistence; it does not imply cloud backup or cross-device recovery.

## MVP screen inventory

| Module / screen state | Required content and actions |
| --- | --- |
| **Module 1 · Local library** | Upload PDF; show admission limits; list saved materials/question sets, active run, and attempt history; resume or retry |
| **Module 2 · Sonar loading** | Actual Extraction → Generation → Validation states, elapsed time, cancel, and specific failure/retry feedback |
| **Module 3 · Zone encounter** | Zone/enemy, difficulty, question count, HP, XP, accessible answer choices, and answer resolution |
| **Module 3 · Answer feedback** | Correctness; for a miss, correct answer, explanation, exact quote, and PDF page; Continue action |
| **Module 4 · Boss review** | Megalodon, mixed-topic label, saved shuffled nine-question order, score toward 8/9 |
| **Module 5 · Results** | Pass/fail, badge if earned, stage/boss scores, mistakes and sources, retry, library, and resume when applicable |

## Local-first behavior and handoff boundaries

- The browser calls the local application API; it does not call Ollama directly. The local API coordinates PDF extraction, Ollama generation, validation, scoring, and SQLite transactions.
- Runtime AI inference and application data stay on the device. Internet access is needed only to install prerequisites and download the model before offline use.
- If Ollama is stopped, show a useful local-service error and preserve the admitted library/run state. If the app closes mid-run, restore the saved run instead of creating a new one.
- Make keyboard focus, answer labels, contrast, reduced-motion support, and visible state changes part of each encounter/loading/result screen.
- Provide local deletion for a document and its associated question set, runs, attempts, progress, and badges. Cancel related work and delete linked records transactionally.
- Do not add user accounts, cloud sync, an expedition map, standalone review or flashcards, leaderboards, broad dashboard quick-access routing, arbitrary file formats, OCR, or long-document support to this MVP.

## Team ownership

| Team | MVP responsibility |
| --- | --- |
| Product / UX | Five-step flow, admission/loading/error copy, answer feedback, run recovery, and results |
| Frontend | Local library, PDF selection, Sonar states, three zones, boss encounter, results, resume |
| Backend | Loopback API, upload admission, run state, scoring, SQLite persistence and transactions |
| Document processing | Bounded PDF extraction, normalized text, page-level source passages, rejection reasons |
| Local AI | Ollama model configuration, question generation, bounded repair, structural and source validation |
| QA | Admission edge cases, question/source correctness, scoring thresholds, close/resume, offline runtime evidence |

Use `point-nemo-masterplan.md` for implementation gates, detailed data contracts, build sequence, and hackathon acceptance evidence. This document defines the learner-facing MVP flow; a described behavior is a target until implementation and acceptance evidence confirm it.
