import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type BackendQuestionSet, type LibraryDocument as BackendLibraryDocument, type RunDetail, type AnswerFeedback, type GenerationJob } from "@point-nemo/shared";
import {
  ApiRequestError, normalizeQuestionSet, toDescentRun, getQuestionSet, fetchLibrary,
  submitRunAnswer, handleResponse, cancelGenerationJob, deleteDocument, validateUploadFile,
} from "../src/api";
import { captureSlot, restoreLatestFeedback } from "../src/answerView";
import { GenerationSession, GenerationFailureError, waitForPoll } from "../src/processing";
import { SourceEvidence } from "../src/components/SourceEvidence";
import { LocalLibrary } from "../src/components/LocalLibrary";
import { ResultsScreen } from "../src/components/ResultsScreen";
import { AuthPanel } from "../src/components/auth/AuthPanel";

const createdAt = "2026-10-09T10:00:00.000Z";
const updatedAt = "2026-10-09T10:20:00.000Z";

function questionSetFixture(): BackendQuestionSet {
  const topics = ["DNS", "IP addressing", "HTTP"].map((name) => ({ id: randomUUID(), name }));
  const evidence = [
    { pageNumber: 1, chunkId: "page-1", quote: "DNS resolves a hostname to an IP address." },
    { pageNumber: 2, chunkId: "page-2", quote: "The client then contacts the IP address." },
  ];
  return {
    id: randomUUID(), documentId: randomUUID(), filename: "Networking excerpt.pdf", compatible: true,
    metadata: { documentHash: "a".repeat(64), extractorVersion: "1", promptVersion: "1", schemaVersion: "1", tokenizerDigest: "tokenizer", modelTag: "local-model", modelDigest: "model", settingsHash: "settings", createdAt },
    extractedPages: evidence.map((reference) => ({ pageNumber: reference.pageNumber, chunkId: reference.chunkId, text: `Complete page context. ${reference.quote} Further context preserved.` })),
    topics,
    questions: topics.flatMap((topic) => (["easy", "medium", "hard"] as const).map((difficulty) => ({
      id: randomUUID(), topicId: topic.id, difficulty, prompt: `${topic.name}: ${difficulty} question?`,
      options: ["First", "Second", "Third", "Fourth"], answerIndex: 2,
      explanation: "The third option follows the supporting source passages.", evidence: evidence.map((reference) => ({ ...reference })),
    }))),
    createdAt,
  };
}

function feedbackFixture(questions: BackendQuestionSet, correct = false): AnswerFeedback {
  return {
    isCorrect: correct, correctAnswerIndex: 2, explanation: "Persisted server explanation.",
    evidence: questions.questions[0].evidence, playerDamageTaken: correct ? 0 : 50,
    enemyDamageTaken: correct ? 50 : 0, xpAwarded: correct ? 10 : 0,
  };
}

function runFixture(questions: BackendQuestionSet): RunDetail {
  const id = randomUUID();
  const firstRound = ["easy", "medium", "hard"].flatMap((difficulty) => questions.questions.filter((question) => question.difficulty === difficulty));
  const bossOrder = [...questions.questions].reverse().map((question) => question.id);
  const slots = [...firstRound.map((question) => question.id), ...bossOrder].map((questionId, slotIndex) => ({
    id: randomUUID(), runId: id, questionId, slotIndex,
    encounterType: slotIndex < 3 ? "surface" as const : slotIndex < 6 ? "twilight" as const : slotIndex < 9 ? "midnight" as const : "boss" as const,
  }));
  const first = firstRound[0];
  return {
    id, questionSetId: questions.id, documentId: questions.documentId, filename: questions.filename,
    updatedAt, bossOrder, slots, state: "active", playerHp: 100, currentEncounterHp: 100,
    xp: 0, combo: 0, currentSlotIndex: 0, rulesVersion: "1.0", createdAt, attempts: [],
    currentSlot: { id: slots[0].id, slotIndex: 0, encounterType: "surface",
      question: { id: first.id, topicId: first.topicId, topicName: questions.topics[0].name, difficulty: first.difficulty, prompt: first.prompt, options: first.options } },
  };
}

function attemptedRun(questions: BackendQuestionSet): RunDetail {
  const run = runFixture(questions);
  const slot = run.currentSlot!;
  const next = questions.questions.find((question) => question.id === run.slots![1].questionId)!;
  const feedback = feedbackFixture(questions);
  return {
    ...run, playerHp: 50, currentSlotIndex: 1, latestFeedback: feedback,
    attempts: [{ id: randomUUID(), slotId: slot.id, questionId: slot.question.id, options: [...slot.question.options],
      slotIndex: 0, encounterType: "surface", selectedOptionIndex: 0, isCorrect: false, feedback,
      questionPrompt: "Original answered question from the server", topicName: "DNS", createdAt: updatedAt }],
    currentSlot: { id: run.slots![1].id, slotIndex: 1, encounterType: "surface",
      question: { id: next.id, topicId: next.topicId, topicName: "IP addressing", difficulty: next.difficulty, prompt: "Next unanswered question", options: ["Next A", "Next B", "Next C", "Next D"] } },
  };
}

function jobFixture(questions: BackendQuestionSet, state: GenerationJob["state"] = "extracting"): GenerationJob {
  return { id: randomUUID(), documentId: questions.documentId, state, questionSetId: state === "ready" ? questions.id : undefined, createdAt, elapsedTimeMs: 1200, retryCount: 0, timings: { extraction: 1200 } };
}
function documentFixture(questions: BackendQuestionSet): BackendLibraryDocument {
  return { id: questions.documentId, filename: questions.filename!, sha256: "a".repeat(64), pageCount: 2, normalizedCharacterCount: 600, createdAt, updatedAt, questionSets: [questions], runs: [], jobs: [] };
}
function ok(data: unknown) { return Response.json({ success: true, data }); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const pdf = () => new File(["%PDF-1.7 text"], "lesson.pdf", { type: "application/pdf" });

test("question adapter preserves filename, topic identity, every quote, full context, metadata, and compatibility", () => {
  const backend = questionSetFixture();
  backend.topics.reverse(); // Topic association must use IDs, not question-array position.
  const normalized = normalizeQuestionSet(backend);
  assert.equal(normalized.documentName, backend.filename);
  assert.equal(normalized.documentId, backend.documentId);
  assert.deepEqual(normalized.topics, ["HTTP", "IP addressing", "DNS"]);
  assert.equal(normalized.questions[0].topic, "DNS");
  assert.equal(normalized.questions[0].topicId, backend.questions[0].topicId);
  assert.equal(normalized.questions[0].questionSetId, backend.id);
  assert.equal(normalized.questions[0].documentId, backend.documentId);
  assert.deepEqual(normalized.questions[0].evidence, backend.questions[0].evidence);
  assert.deepEqual(normalized.extractedPages, backend.extractedPages);
  assert.deepEqual(normalized.metadata, backend.metadata);
  assert.equal(normalized.compatible, true);
});

test("adapter rejects unknown topics and missing filenames rather than inventing a lesson", () => {
  const backend = questionSetFixture();
  backend.questions[0].topicId = randomUUID();
  assert.throws(() => normalizeQuestionSet(backend), { code: "INVALID_RESPONSE" });
  assert.throws(() => normalizeQuestionSet({ ...questionSetFixture(), filename: undefined }), { code: "INVALID_RESPONSE" });
  assert.equal(normalizeQuestionSet({ ...questionSetFixture(), compatible: undefined }).compatible, false);
});

test("question-set fetch validates the backend shape before normalizing all evidence", async (t) => {
  const backend = questionSetFixture();
  t.mock.method(globalThis, "fetch", async () => ok(backend));
  const questions = await getQuestionSet(backend.id);
  assert.deepEqual(questions.questions[0].evidence, backend.questions[0].evidence);
  assert.equal(questions.filename, backend.filename);
});

test("run adapter preserves the saved boss order, document identity, timestamps, status, and real attempt question IDs", () => {
  const questions = questionSetFixture();
  const detail = attemptedRun(questions);
  const bossSlot = detail.slots![12];
  const bossQuestion = questions.questions.find((question) => question.id === bossSlot.questionId)!;
  detail.currentSlotIndex = 12;
  detail.currentSlot = { id: bossSlot.id, slotIndex: 12, encounterType: "boss",
    question: { id: bossQuestion.id, topicId: bossQuestion.topicId, topicName: "HTTP", difficulty: bossQuestion.difficulty, prompt: bossQuestion.prompt, options: bossQuestion.options } };
  const run = toDescentRun(detail, normalizeQuestionSet(questions));
  assert.equal(run.stage, "boss");
  assert.equal(run.currentQuestionIndex, 3);
  assert.deepEqual(run.shuffledBossOrder, detail.bossOrder);
  assert.notDeepEqual(run.shuffledBossOrder, questions.questions.map((question) => question.id));
  assert.equal(run.attempts[0].questionId, detail.attempts![0].questionId);
  assert.notEqual(run.attempts[0].questionId, detail.attempts![0].slotId);
  assert.equal(run.documentName, questions.filename);
  assert.equal(run.documentId, questions.documentId);
  assert.equal(run.updatedAt, updatedAt);
  assert.equal(run.status, "active");
});

test("failure uses the server failure stage and terminal status; unavailable server order is rejected", () => {
  const backend = questionSetFixture();
  const detail = { ...attemptedRun(backend), state: "failed" as const, failureStage: "twilight" as const, currentSlotIndex: 6, currentSlot: undefined, playerHp: 0 };
  const run = toDescentRun(detail);
  assert.equal(run.stage, "results");
  assert.equal(run.status, "failed");
  assert.equal(run.failureStage, "twilight");
  assert.match(run.failureReason!, /Twilight zone threshold/);
  assert.throws(() => toDescentRun({ ...detail, bossOrder: undefined }), { code: "INVALID_RESPONSE" });
  assert.throws(() => toDescentRun(detail, normalizeQuestionSet(questionSetFixture())), { code: "INVALID_RESPONSE" });
});

test("resume feedback associates the previous prompt/options and both quotes with the previous slot", () => {
  const backend = questionSetFixture();
  const detail = attemptedRun(backend);
  const restored = restoreLatestFeedback(detail, normalizeQuestionSet(backend))!;
  assert.equal(restored.slotId, detail.attempts![0].slotId);
  assert.equal(restored.question.id, detail.attempts![0].questionId);
  assert.equal(restored.question.prompt, "Original answered question from the server");
  assert.deepEqual(restored.question.options, ["First", "Second", "Third", "Fourth"]);
  assert.notDeepEqual(restored.question.options, detail.currentSlot!.question.options);
  assert.deepEqual(restored.feedback.evidence, detail.latestFeedback!.evidence);
});

test("capture protects the question/options used for a submitted slot from later changes", () => {
  const detail = runFixture(questionSetFixture());
  const captured = captureSlot(detail.currentSlot!);
  detail.currentSlot!.question.options[0] = "Changed";
  assert.equal(captured.question.options[0], "First");
  assert.equal(captured.id, detail.currentSlot!.id);
});

test("a lost answer response retries only the captured slot and option, with no GET or question-set fetch", async (t) => {
  const backend = questionSetFixture();
  const detail = attemptedRun(backend);
  const capturedId = detail.attempts![0].slotId;
  const requests: { url: string; method?: string; body: unknown }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method, body: JSON.parse(String(init?.body)) });
    if (requests.length === 1) throw new TypeError("Connection lost after submission");
    return ok({ run: detail, feedback: detail.latestFeedback });
  });
  await assert.rejects(submitRunAnswer(detail.id, capturedId, 0), /Connection lost/);
  const retry = await submitRunAnswer(detail.id, capturedId, 0);
  assert.equal(retry.run.currentSlot!.id, detail.currentSlot!.id);
  assert.notEqual(retry.run.currentSlot!.id, capturedId);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.method, "POST");
    assert.equal(request.url, `/api/runs/${detail.id}/answers`);
    assert.deepEqual(request.body, { slotId: capturedId, selectedOptionIndex: 0 });
  }
});

test("rejected submissions preserve API code/message/retryability and never return guessed feedback", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: false, error: { code: "ANSWER_CONFLICT", message: "That slot has a different saved answer.", retryable: false } }, { status: 409 }));
  await assert.rejects(submitRunAnswer(randomUUID(), randomUUID(), 2), (error: unknown) => {
    assert.ok(error instanceof ApiRequestError);
    assert.equal(error.code, "ANSWER_CONFLICT"); assert.equal(error.statusCode, 409);
    assert.equal(error.retryable, false); assert.match(error.message, /different saved answer/);
    return true;
  });
});

test("malformed successful answer responses reject rather than displaying feedback", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ok({ run: {}, feedback: undefined }));
  await assert.rejects(submitRunAnswer(randomUUID(), randomUUID(), 0), { code: "INVALID_RESPONSE" });
});

test("API errors and unreadable responses surface readable errors", async () => {
  await assert.rejects(handleResponse(new Response("server stopped", { status: 503 })), { code: "HTTP_ERROR", statusCode: 503, retryable: true });
  await assert.rejects(handleResponse(new Response("not JSON", { status: 200 })), { code: "INVALID_RESPONSE" });
  await assert.rejects(handleResponse(Response.json({ success: false, error: { code: "BUSY", message: "Generation is already active.", retryable: true } })), { code: "BUSY", retryable: true });
});

test("library reads documents directly, retaining compatible saved lessons even without runs", async (t) => {
  const backend = questionSetFixture();
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => { urls.push(url); return ok([documentFixture(backend), { ...documentFixture(backend), id: randomUUID(), filename: "Failed excerpt.pdf", questionSets: [] }]); });
  const documents = await fetchLibrary();
  assert.deepEqual(urls, ["/api/documents"]);
  assert.equal(documents.length, 2); assert.equal(documents[0].runs.length, 0);
  assert.equal(documents[0].questionSets[0].compatible, true);
  assert.equal(documents[1].questionSets.length, 0);
});

test("library failures propagate instead of masquerading as an empty archive", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Local records unavailable.", retryable: true } }, { status: 503 }));
  await assert.rejects(fetchLibrary(), { code: "DATABASE_UNAVAILABLE" });
});

test("library rejects cross-document question sets instead of mixing lessons", async (t) => {
  const backend = questionSetFixture();
  t.mock.method(globalThis, "fetch", async () => ok([{ ...documentFixture(backend), id: randomUUID() }]));
  await assert.rejects(fetchLibrary(), { code: "INVALID_RESPONSE" });
});

test("document deletion sends DELETE, accepts repeated 204s without parsing JSON, and propagates errors", async (t) => {
  const methods: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => { methods.push(init!.method!); return new Response(null, { status: 204 }); });
  await deleteDocument("document-id"); await deleteDocument("document-id");
  assert.deepEqual(methods, ["DELETE", "DELETE"]);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: { code: "DELETE_FAILED", message: "Deletion not confirmed.", retryable: true } }, { status: 503 }));
  await assert.rejects(deleteDocument("document-id"), { code: "DELETE_FAILED" });
});

test("cancel API posts to the job endpoint and preserves terminal errors/stage/timings", async (t) => {
  const job = { ...jobFixture(questionSetFixture(), "failed"), errorStage: "validating" as const, errorMessage: "A quote is absent from its source chunk.", errorCode: "INVALID_EVIDENCE" };
  let method: string | undefined;
  let path = "";
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => { path = url; method = init?.method; return ok(job); });
  const result = await cancelGenerationJob(job.id);
  assert.equal(path, `/api/jobs/${job.id}/cancel`); assert.equal(method, "POST");
  assert.equal(result.errorStage, "validating"); assert.equal(result.errorMessage, job.errorMessage);
  assert.deepEqual(result.timings, job.timings);
});

test("upload admission enforces 5 MiB, empty files, .pdf extension and PDF MIME", () => {
  const valid = { name: "notes.pdf", type: "application/pdf", size: 5 * 1024 * 1024 };
  assert.equal(validateUploadFile(valid), null);
  assert.equal(validateUploadFile({ ...valid, type: "" }), null);
  assert.match(validateUploadFile({ ...valid, size: valid.size + 1 })!, /5 MiB/);
  assert.match(validateUploadFile({ ...valid, size: 0 })!, /empty/);
  assert.match(validateUploadFile({ ...valid, name: "notes.exe" })!, /PDF/);
  assert.match(validateUploadFile({ ...valid, type: "image/png" })!, /PDF/);
});

test("cancellation during upload waits for its receipt, stops the job once, and never polls/loads questions", async () => {
  const backend = questionSetFixture();
  const receipt = deferred<{ documentId: string; jobId: string }>();
  const job = jobFixture(backend, "cancelled");
  let polls = 0; let loads = 0; const cancelled: string[] = [];
  const session = new GenerationSession({ upload: () => receipt.promise,
    poll: async () => { polls++; return job; }, questionSet: async () => { loads++; return normalizeQuestionSet(backend); },
    cancel: async (id) => { cancelled.push(id); return job; }, wait: async () => {} });
  const started = session.start(pdf(), () => assert.fail("cancelled upload must not update stages"));
  const cancellation = session.cancel();
  assert.equal(session.cancelRequested, true); assert.equal(cancelled.length, 0);
  receipt.resolve({ documentId: backend.documentId, jobId: job.id });
  await cancellation;
  assert.equal(await started, null);
  assert.deepEqual(cancelled, [job.id]); assert.equal(polls, 0); assert.equal(loads, 0);
});

test("a late ready poll after cancellation cannot load questions or transition the UI", async () => {
  const backend = questionSetFixture();
  const ready = jobFixture(backend, "ready");
  const poll = deferred<GenerationJob>();
  const polling = deferred<void>();
  let loads = 0; let stages = 0; let cancels = 0;
  const session = new GenerationSession({ upload: async () => ({ documentId: backend.documentId, jobId: ready.id }),
    poll: async () => { polling.resolve(); return poll.promise; },
    questionSet: async () => { loads++; return normalizeQuestionSet(backend); },
    cancel: async () => { cancels++; return { ...ready, state: "cancelled" }; }, wait: async () => {} });
  const started = session.start(pdf(), () => { stages++; });
  await polling.promise; await session.cancel(); poll.resolve(ready);
  assert.equal(await started, null); assert.equal(loads, 0); assert.equal(stages, 0); assert.equal(cancels, 1);
});

test("cancellation during question loading suppresses the late question set", async () => {
  const backend = questionSetFixture();
  const ready = jobFixture(backend, "ready");
  const loaded = deferred<ReturnType<typeof normalizeQuestionSet>>();
  const loading = deferred<void>();
  const session = new GenerationSession({ upload: async () => ({ documentId: backend.documentId, jobId: ready.id }),
    poll: async () => ready, questionSet: async () => { loading.resolve(); return loaded.promise; },
    cancel: async () => ready, wait: async () => {} });
  const started = session.start(pdf(), () => {});
  await loading.promise; const cancellation = await session.cancel(); loaded.resolve(normalizeQuestionSet(backend));
  assert.equal(cancellation!.state, "ready"); assert.equal(await started, null);
});

test("deleting the document suppresses an in-flight job response without recreating state", async () => {
  const backend = questionSetFixture();
  const job = jobFixture(backend, "ready");
  const poll = deferred<GenerationJob>(); const polling = deferred<void>(); let loads = 0;
  const session = new GenerationSession({ upload: async () => ({ documentId: backend.documentId, jobId: job.id }),
    poll: async () => { polling.resolve(); return poll.promise; }, questionSet: async () => { loads++; return normalizeQuestionSet(backend); },
    cancel: async () => assert.fail("DELETE already stops the server job"), wait: async () => {} });
  const started = session.start(pdf(), () => assert.fail("deleted document must not update stages"));
  await polling.promise; session.documentDeleted(); poll.resolve(job);
  assert.equal(await started, null); assert.equal(loads, 0);
});

test("failed generation propagates the actual error message/stage without a saved or fabricated fallback", async () => {
  const backend = questionSetFixture();
  const failed = { ...jobFixture(backend, "failed"), errorStage: "validating" as const, errorMessage: "Evidence does not match page 2.", errorCode: "INVALID_EVIDENCE" };
  const session = new GenerationSession({ upload: async () => ({ documentId: backend.documentId, jobId: failed.id }),
    poll: async () => failed, questionSet: async () => assert.fail("Failed generation must not load substitute questions"),
    cancel: async () => failed, wait: async () => {} });
  await assert.rejects(session.start(pdf(), () => {}), (error: unknown) => {
    assert.ok(error instanceof GenerationFailureError); assert.equal(error.job.errorStage, "validating"); assert.equal(error.message, failed.errorMessage); return true;
  });
});

test("poll transport errors surface and leave the receipt available for explicit cancellation", async () => {
  const backend = questionSetFixture(); const job = jobFixture(backend, "cancelled"); let cancels = 0;
  const session = new GenerationSession({ upload: async () => ({ documentId: backend.documentId, jobId: job.id }),
    poll: async () => { throw new TypeError("Local server unreachable"); }, questionSet: async () => assert.fail("No questions on transport failure"),
    cancel: async () => { cancels++; return job; }, wait: async () => {} });
  await assert.rejects(session.start(pdf(), () => {}), /Local server unreachable/);
  assert.equal(session.jobId, job.id); assert.equal(cancels, 0);
  await session.cancel(); assert.equal(cancels, 1);
});

test("poll delay stops promptly on abort", async () => {
  const controller = new AbortController();
  const waiting = waitForPoll(controller.signal);
  controller.abort(); await assert.rejects(waiting, { name: "AbortError" });
});

test("a failed cancel stays unconfirmed and is retried only by an explicit user retry", async () => {
  const backend = questionSetFixture(); const ready = jobFixture(backend, "ready");
  const poll = deferred<GenerationJob>(); const polling = deferred<void>(); let cancels = 0;
  const session = new GenerationSession({ upload: async () => ({ documentId: backend.documentId, jobId: ready.id }),
    poll: async () => { polling.resolve(); return poll.promise; }, questionSet: async () => assert.fail("cancelled UI must not load questions"),
    cancel: async () => { cancels++; if (cancels === 1) throw new Error("Server did not confirm cancellation"); return { ...ready, state: "cancelled" }; }, wait: async () => {} });
  const started = session.start(pdf(), () => {});
  const startRejection = assert.rejects(started, /did not confirm/);
  await polling.promise;
  await assert.rejects(session.cancel(), /did not confirm/);
  poll.resolve(ready); await startRejection;
  assert.equal(cancels, 1);
  await session.cancel(true); assert.equal(cancels, 2);
});

test("successful generation reports real stages and returns only its own new saved set", async () => {
  const backend = questionSetFixture(); const job = jobFixture(backend);
  const states: GenerationJob["state"][] = ["extracting", "generating", "validating", "ready"];
  const reported: string[] = []; let index = 0;
  const session = new GenerationSession({ upload: async () => ({ documentId: backend.documentId, jobId: job.id }),
    poll: async () => { const state = states[index++]; return { ...job, state, questionSetId: state === "ready" ? backend.id : undefined }; },
    questionSet: async () => normalizeQuestionSet(backend), cancel: async () => assert.fail("No automatic cancellation of a completed generation"), wait: async () => {} });
  const result = await session.start(pdf(), (current) => reported.push(current.state));
  assert.deepEqual(reported, states); assert.equal(result!.id, backend.id);
});

test("wrong-document job responses are rejected before stage updates or loading questions", async () => {
  const backend = questionSetFixture(); const job = jobFixture(backend, "ready");
  const session = new GenerationSession({ upload: async () => ({ documentId: backend.documentId, jobId: job.id }),
    poll: async () => ({ ...job, documentId: randomUUID() }), questionSet: async () => assert.fail("Wrong-document job must not load questions"),
    cancel: async () => job, wait: async () => {} });
  await assert.rejects(session.start(pdf(), () => assert.fail("Wrong-document job must not update stage")), { code: "INVALID_RESPONSE" });
});

test("supporting passages render both quotes and their complete matching chunk context", () => {
  const backend = questionSetFixture();
  const markup = renderToStaticMarkup(createElement(SourceEvidence, { evidence: backend.questions[0].evidence, questionSet: normalizeQuestionSet(backend) }));
  for (const evidence of backend.questions[0].evidence) {
    assert.ok(markup.includes(evidence.quote)); assert.ok(markup.includes(evidence.chunkId));
  }
  for (const page of backend.extractedPages!) assert.ok(markup.includes(page.text));
});

test("library UI displays documents without runs, saved-generation dates, admission rules, and incompatible sets", () => {
  const backend = { ...questionSetFixture(), compatible: false };
  const markup = renderToStaticMarkup(createElement(LocalLibrary, {
    documents: [{ ...documentFixture(backend), questionSets: [normalizeQuestionSet(backend)] }], error: null, busy: null,
    onRefresh() {}, onUploadClick() {}, onResumeRun() {}, onTryAgain() {}, onViewResults() {}, onUseSaved() {},
    onDeleteDocument: async () => {}, onCancelJob() {}, status: { api: { available: true, message: "Local API connected" }, ai: { available: false, message: "Ollama stopped" } },
    onOpenSettings() {}, currentUser: { displayName: "Explorer" }, onChangeName() {},
  }));
  assert.ok(markup.includes(backend.filename!)); assert.ok(markup.includes("No runs yet"));
  assert.ok(markup.includes("Saved questions")); assert.ok(markup.includes("Incompatible"));
  assert.match(markup, /disabled=""[^>]*>USE SAVED QUESTIONS|disabled=""[^>]*>.*?USE SAVED QUESTIONS/);
  for (const label of ["5 MiB", "3 pages", "8,000", "300 non-whitespace", "English text-based", "DELETE DOCUMENT AND PROGRESS"]) assert.ok(markup.includes(label));
  assert.ok(!markup.includes("No limit")); assert.ok(!markup.includes("[object Object]"));
});

test("results use the real failure stage and saved feedback/options for mistakes, including both source passages", () => {
  const backend = questionSetFixture();
  const detail = { ...attemptedRun(backend), state: "failed" as const, failureStage: "twilight" as const, currentSlot: undefined };
  const markup = renderToStaticMarkup(createElement(ResultsScreen, { run: toDescentRun(detail), questionSet: normalizeQuestionSet(backend), onTryAgain() {}, onReturnToLibrary() {}, onStartNewPdf() {} }));
  assert.ok(markup.includes("EXPEDITION ENDED AT TWILIGHT")); assert.ok(!markup.includes("ENDED AT RESULTS"));
  assert.ok(markup.includes("Original answered question from the server")); assert.ok(markup.includes("Persisted server explanation"));
  assert.ok(markup.includes("First")); assert.ok(markup.includes("Third"));
  for (const evidence of backend.questions[0].evidence) assert.ok(markup.includes(evidence.quote));
});

test("local explorer setup requests only an optional name, with truthful shared-user storage labels", () => {
  const markup = renderToStaticMarkup(createElement(AuthPanel, { onSuccess() {} }));
  assert.ok(markup.includes("one local user")); assert.ok(markup.includes("shares its library"));
  assert.ok(markup.includes("EXPLORER NAME (OPTIONAL)")); assert.ok(markup.includes("OPEN LOCAL LIBRARY"));
  assert.ok(!markup.includes('type="password"')); assert.ok(!markup.includes('type="email"'));
});
