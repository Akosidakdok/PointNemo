# Point Nemo local API

The Express API listens on `127.0.0.1:3001` during development. Vite proxies `/api` from the web app. The browser never connects to Ollama or SQLite directly.

All state is stored on the same device. The default database path is `%LOCALAPPDATA%\PointNemo\point-nemo.sqlite` on Windows and `$XDG_DATA_HOME/PointNemo/point-nemo.sqlite` (or `~/.local/share/PointNemo/point-nemo.sqlite`) on other platforms. `DATABASE_PATH` can override it.

## Endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/health` | API/database readiness and configured local-model status |
| `GET` | `/api/ai/status` | Ollama reachability and whether the configured model is installed |
| `GET` | `/api/documents` | Local document records, saved sets, jobs, and run summaries |
| `POST` | `/api/documents` | Admit one PDF, create a document and generation job; returns `202` |
| `DELETE` | `/api/documents/:documentId` | Cancel related processing and delete the document and dependent local data; repeat deletion is safe |
| `GET` | `/api/jobs/:jobId` | Current state, elapsed time, error, and ready question-set ID |
| `POST` | `/api/jobs/:jobId/cancel` | Idempotently cancel a nonterminal job and prevent late commits |
| `POST` | `/api/jobs/:jobId/retry` | Start a new job from saved extraction after a generation failure; returns `202` |
| `POST` | `/api/runs` | Create a run from a ready question set; returns `201` |
| `GET` | `/api/runs/:runId` | Return saved run state, current unanswered question, stage scores, and latest feedback |
| `POST` | `/api/runs/:runId/answers` | Atomically score a selected answer, save feedback and advance progression |

### Upload

Send `multipart/form-data` with one file field named `file`:

```cmd
curl -F "file=@lesson.pdf" http://127.0.0.1:3001/api/documents
```

Admission requires a valid English text-based PDF under 5 MiB, at most 3 pages, 300–8,000 normalized non-whitespace/total text limits, and usable source pages. OCR is not run. Raw PDF bytes are held in memory for parsing and released; the normalized page text is stored locally for evidence, explicit retries, and saved-set reuse.

Successful upload response:

```json
{
  "documentId": "uuid",
  "jobId": "uuid",
  "state": "extracting"
}
```

Only one generation job runs at a time. Poll `GET /api/jobs/:jobId`; states are `extracting`, `generating`, `validating`, `ready`, `failed`, or `cancelled`. Each job has a 90-second total deadline and at most one model repair attempt. A failed generation job can be explicitly retried using its saved extraction; an extraction failure requires a new PDF upload.

### Question set and game

The ready set has exactly three distinct topics and nine questions, one at each difficulty for each topic. The API validates the four answer options, answer index, explanation, topic/difficulty coverage, unique prompts, and exact quoted evidence on a cited PDF page before committing the set.

Create a run:

```json
{ "questionSetId": "uuid" }
```

Answer submission:

```json
{ "slotId": "uuid", "selectedOptionIndex": 0 }
```

The response includes `feedback` (correctness, answer, explanation, evidence, damage, XP, and stage result) and the updated run snapshot. Active question data omits its answer key and evidence until the answer is submitted. The API freezes three questions per zone and a shuffled nine-slot boss order when the run is created. A repeated identical answer returns its original feedback/state without applying score or damage twice; changed or out-of-order answers return `409`.

Rules are `point-nemo-rules-v1`: Surface/Twilight/Midnight each start at 100 player HP and 100 enemy HP, deal 50 enemy damage per correct answer, award 10 XP per correct answer, and require 2/3. Point Nemo starts at 100 player HP and 80 Megalodon HP, deals 10 enemy damage per correct answer, and requires 8/9. Every slot is presented before the encounter result is resolved. A completed boss run receives the run-tied `Descent Complete` badge.

## Error responses

```json
{
  "error": {
    "code": "PDF_TOO_LARGE",
    "message": "The PDF must be under 5 MiB.",
    "retryable": false
  }
}
```

Invalid input is returned with a specific code and safe message. Retryable is true for transient service/time-limit failures; it is false for admission, validation, conflict, and not-found errors. Source text and raw model output are not included in error responses or routine logs.

## Current integration boundary

These routes are implemented in the local API. The main React web app has not yet been connected to them; its current UI still shows the earlier expedition shell. Use the UI playground for visual work while the frontend integration is built.
