import {
  BackendQuestionSetSchema, RunDetailSchema, GenerationJobSchema,
  AnswerSubmitResponseSchema, LibraryDocumentSchema,
  type BackendQuestionSet, type FrontendQuestionSet,
  type DescentRun as SharedDescentRun,
  type QuestionAttempt as SharedQuestionAttempt,
  type DescentZone, type PointNemoQuestion, type RunDetail, type AnswerFeedback,
  type ActiveQuestion, type CurrentSlot, type RunAttemptDetail,
  type AnswerSubmitResponse, type Evidence, type JobState, type GenerationJob,
  type LibraryDocument as BackendLibraryDocument,
} from "@point-nemo/shared";

export type {
  DescentZone, PointNemoQuestion, RunDetail, AnswerFeedback, ActiveQuestion,
  CurrentSlot, RunAttemptDetail, AnswerSubmitResponse, Evidence, JobState, GenerationJob,
};

export type EncounterStage = Exclude<DescentZone, "results">;
export type StudyQuestion = PointNemoQuestion & {
  topicId: string;
  documentId: string;
  questionSetId: string;
  evidence: Evidence[];
};
// Components consume this normalized frontend shape, never the shared union.
export type QuestionSet = Omit<FrontendQuestionSet, "questions" | "extractedPages"> & {
  documentId: string;
  filename: string;
  compatible: boolean;
  metadata: BackendQuestionSet["metadata"];
  topicDetails: BackendQuestionSet["topics"];
  extractedPages: NonNullable<BackendQuestionSet["extractedPages"]>;
  questions: StudyQuestion[];
};
export type QuestionAttempt = SharedQuestionAttempt & {
  slotId: string;
  questionPrompt: string;
  topicName: string;
  options: string[];
  feedback: AnswerFeedback;
};
export type DescentRun = Omit<SharedDescentRun, "attempts"> & {
  documentId: string;
  failureStage?: EncounterStage;
  attempts: QuestionAttempt[];
};
export type LibraryDocument = Omit<BackendLibraryDocument, "questionSets"> & {
  questionSets: QuestionSet[];
};

export interface ServiceStatus {
  available: boolean;
  model?: string;
  message: string;
}
export interface AppStatus { api: ServiceStatus; ai: ServiceStatus }
export interface ApiEnvelope<T> { success: true; data: T }

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code = "API_ERROR",
    public readonly statusCode = 400,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function handleResponse<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError(
      response.ok ? "The local API returned an unreadable response." : `Request failed with HTTP ${response.status}.`,
      response.ok ? "INVALID_RESPONSE" : "HTTP_ERROR", response.status, response.status >= 500,
    );
  }
  if (!response.ok || (isRecord(payload) && payload.success === false)) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
    throw new ApiRequestError(
      typeof error.message === "string" ? error.message : `Request failed with HTTP ${response.status}.`,
      typeof error.code === "string" ? error.code : "HTTP_ERROR",
      response.status,
      typeof error.retryable === "boolean" ? error.retryable : response.status >= 500,
    );
  }
  return payload as T;
}

async function envelopeData(response: Response): Promise<unknown> {
  const payload = await handleResponse<unknown>(response);
  if (!isRecord(payload) || payload.success !== true || !("data" in payload)) {
    throw new ApiRequestError("The local API returned an incomplete response.", "INVALID_RESPONSE", response.status);
  }
  return payload.data;
}

function requestSignal(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
}

async function getData(path: string, signal?: AbortSignal): Promise<unknown> {
  return envelopeData(await fetch(path, { signal: requestSignal(5_000, signal) }));
}

function invalidResponse(): never {
  throw new ApiRequestError("The local API response does not match the study contract. Refresh after checking the local server.", "INVALID_RESPONSE", 502);
}

export function validateUploadFile(file: Pick<File, "name" | "size" | "type">): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
    return "Choose one English text-based PDF file (.pdf).";
  }
  if (file.size === 0) return "This file is empty. Export a text-based PDF excerpt.";
  if (file.size > 5 * 1024 * 1024) return "The PDF must be at most 5 MiB. Export a smaller excerpt.";
  return null;
}

export async function uploadDocument(file: File): Promise<{ documentId: string; jobId: string }> {
  const error = validateUploadFile(file);
  if (error) throw new ApiRequestError(error, "INVALID_INPUT", 400);
  const formData = new FormData();
  formData.append("file", file);
  // Keep the upload alive on Cancel so its receipt can identify the job to stop.
  const data = await envelopeData(await fetch("/api/documents", {
    method: "POST", body: formData, signal: AbortSignal.timeout(15_000),
  }));
  if (!isRecord(data) || typeof data.documentId !== "string" || typeof data.jobId !== "string") invalidResponse();
  return { documentId: data.documentId, jobId: data.jobId };
}

export async function getGenerationJob(jobId: string, signal?: AbortSignal): Promise<GenerationJob> {
  const result = GenerationJobSchema.safeParse(await getData(`/api/jobs/${encodeURIComponent(jobId)}`, signal));
  if (!result.success) invalidResponse();
  return result.data;
}

export async function cancelGenerationJob(jobId: string): Promise<GenerationJob> {
  const result = GenerationJobSchema.safeParse(await envelopeData(await fetch(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST", signal: AbortSignal.timeout(5_000),
  })));
  if (!result.success) invalidResponse();
  return result.data;
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE", signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) await handleResponse(response);
  // Successful deletion is 204 and intentionally has no JSON body.
  if (response.status !== 204) invalidResponse();
}

function fourOptions(options: string[]): [string, string, string, string] {
  if (options.length !== 4 || options.some((option) => typeof option !== "string" || !option.trim())) invalidResponse();
  return [options[0], options[1], options[2], options[3]];
}

function answerIndex(index: number): 0 | 1 | 2 | 3 {
  if (index === 0 || index === 1 || index === 2 || index === 3) return index;
  return invalidResponse();
}

export function normalizeQuestionSet(backend: BackendQuestionSet): QuestionSet {
  if (!backend.filename || backend.topics.length !== 3 || backend.questions.length !== 9) invalidResponse();
  const topicNames = new Map(backend.topics.map((topic) => [topic.id, topic.name]));
  if (topicNames.size !== 3) invalidResponse();
  const questions = backend.questions.map((question): StudyQuestion => {
    const topic = topicNames.get(question.topicId);
    const firstEvidence = question.evidence[0];
    if (!topic || !firstEvidence) invalidResponse();
    return {
      id: question.id, topicId: question.topicId, topic,
      questionSetId: backend.id, documentId: backend.documentId,
      difficulty: question.difficulty, prompt: question.prompt,
      options: fourOptions(question.options), answerIndex: answerIndex(question.answerIndex),
      explanation: question.explanation,
      sourcePage: firstEvidence.pageNumber, sourceQuote: firstEvidence.quote,
      evidence: question.evidence.map((evidence) => ({ ...evidence })),
    };
  });
  return {
    id: backend.id, documentId: backend.documentId,
    documentName: backend.filename, filename: backend.filename,
    topics: [backend.topics[0].name, backend.topics[1].name, backend.topics[2].name],
    topicDetails: backend.topics.map((topic) => ({ ...topic })), questions,
    extractedPages: (backend.extractedPages ?? []).map((page) => ({ ...page })),
    metadata: backend.metadata, compatible: backend.compatible === true,
    createdAt: backend.createdAt,
  };
}

export async function getQuestionSet(questionSetId: string, signal?: AbortSignal): Promise<QuestionSet> {
  const result = BackendQuestionSetSchema.safeParse(await getData(`/api/question-sets/${encodeURIComponent(questionSetId)}`, signal));
  if (!result.success) invalidResponse();
  return normalizeQuestionSet(result.data);
}

export async function createRun(questionSetId: string): Promise<RunDetail> {
  const result = RunDetailSchema.safeParse(await envelopeData(await fetch("/api/runs", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionSetId }), signal: AbortSignal.timeout(5_000),
  })));
  if (!result.success) invalidResponse();
  return result.data;
}

export async function getRun(runId: string): Promise<RunDetail> {
  const result = RunDetailSchema.safeParse(await getData(`/api/runs/${encodeURIComponent(runId)}`));
  if (!result.success) invalidResponse();
  return result.data;
}

export async function submitAnswer(runId: string, slotId: string, selectedOptionIndex: number): Promise<AnswerSubmitResponse> {
  const result = AnswerSubmitResponseSchema.safeParse(await envelopeData(await fetch(`/api/runs/${encodeURIComponent(runId)}/answers`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slotId, selectedOptionIndex }), signal: AbortSignal.timeout(5_000),
  })));
  if (!result.success) invalidResponse();
  return result.data;
}

// Retries always submit the captured slot and option, including after a lost response.
export const submitRunAnswer = submitAnswer;

export function toDescentRun(runDetail: RunDetail, questionSet?: QuestionSet): DescentRun {
  const documentId = runDetail.documentId ?? questionSet?.documentId;
  const filename = runDetail.filename || questionSet?.filename;
  if (!documentId || !filename || !runDetail.updatedAt || runDetail.bossOrder?.length !== 9) invalidResponse();
  if (new Set(runDetail.bossOrder).size !== 9 || (runDetail.state === "failed" && !runDetail.failureStage)) invalidResponse();
  if (questionSet && (questionSet.documentId !== documentId || questionSet.id !== runDetail.questionSetId)) invalidResponse();
  const stage: DescentZone = runDetail.state === "active"
    ? runDetail.currentSlot?.encounterType ?? invalidResponse()
    : "results";
  const stageStart = { surface: 0, twilight: 3, midnight: 6, boss: 9, results: 0 };
  const attempts: QuestionAttempt[] = (runDetail.attempts ?? []).map((attempt) => {
    if (!attempt.questionId || attempt.options?.length !== 4) invalidResponse();
    return {
      questionId: attempt.questionId, slotId: attempt.slotId, slotIndex: attempt.slotIndex,
      zone: attempt.encounterType, selectedAnswer: attempt.selectedOptionIndex,
      isCorrect: attempt.isCorrect, answeredAt: attempt.createdAt,
      questionPrompt: attempt.questionPrompt, topicName: attempt.topicName,
      options: [...attempt.options], feedback: attempt.feedback,
    };
  });
  const score = (zone: EncounterStage) => attempts.filter((attempt) => attempt.zone === zone && attempt.isCorrect).length;
  const failureStage = runDetail.failureStage;
  const failureReason = runDetail.state === "failed" && failureStage
    ? `${failureStage === "boss" ? "Mixed-topic boss review" : `${failureStage[0].toUpperCase()}${failureStage.slice(1)} zone`} threshold missed (${score(failureStage)}/${failureStage === "boss" ? 9 : 3}; ${failureStage === "boss" ? "8/9" : "2/3"} required).`
    : undefined;
  return {
    id: runDetail.id, documentId, questionSetId: runDetail.questionSetId,
    documentName: filename, stage, status: runDetail.state,
    currentQuestionIndex: runDetail.state === "active" ? runDetail.currentSlotIndex - stageStart[stage] : 0,
    playerHp: runDetail.playerHp, enemyHp: runDetail.currentEncounterHp, xp: runDetail.xp,
    shuffledBossOrder: [...runDetail.bossOrder], attempts,
    zoneScores: {
      surface: score("surface"), twilight: score("twilight"), midnight: score("midnight"),
      boss: attempts.some((attempt) => attempt.zone === "boss") ? score("boss") : undefined,
    },
    failureStage, failureReason, createdAt: runDetail.createdAt, updatedAt: runDetail.updatedAt,
    completedAt: runDetail.state === "completed" ? runDetail.updatedAt : undefined,
  };
}

export async function fetchLibrary(): Promise<LibraryDocument[]> {
  const data = await getData("/api/documents");
  if (!Array.isArray(data)) invalidResponse();
  return data.map((document) => {
    const result = LibraryDocumentSchema.safeParse(document);
    if (!result.success) invalidResponse();
    const questionSets = result.data.questionSets.map(normalizeQuestionSet);
    for (const run of result.data.runs) {
      toDescentRun(run, questionSets.find((questions) => questions.id === run.questionSetId));
      if (run.documentId !== result.data.id) invalidResponse();
    }
    if (questionSets.some((questions) => questions.documentId !== result.data.id)) invalidResponse();
    if (result.data.jobs.some((job) => job.documentId !== result.data.id)) invalidResponse();
    return { ...result.data, questionSets };
  });
}

export async function getAppStatus(): Promise<AppStatus> {
  const [health, ai] = await Promise.allSettled([
    fetch("/api/health", { signal: AbortSignal.timeout(3500) }).then((response) => handleResponse<unknown>(response)),
    fetch("/api/ai/status", { signal: AbortSignal.timeout(3500) }).then((response) => handleResponse<unknown>(response)),
  ]);
  const apiAvailable = health.status === "fulfilled" && isRecord(health.value) && health.value.status === "ok";
  const aiStatus = ai.status === "fulfilled" && isRecord(ai.value)
    && typeof ai.value.available === "boolean" && typeof ai.value.message === "string"
    ? { available: ai.value.available, message: ai.value.message, model: typeof ai.value.model === "string" ? ai.value.model : undefined }
    : { available: false, message: "Could not check the local Ollama service." };
  return {
    api: { available: apiAvailable, message: apiAvailable ? "Local API connected." : "Local API unavailable. Start the local server and refresh." },
    ai: apiAvailable ? aiStatus : { available: false, message: "AI status unavailable while the local API is stopped." },
  };
}
