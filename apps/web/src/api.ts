import {
  type DescentRun,
  type DescentZone,
  type PointNemoQuestion,
  type QuestionAttempt,
  type QuestionSet,
  type RunDetail,
  type AnswerFeedback,
  type ActiveQuestion,
  type CurrentSlot,
  type RunAttemptDetail,
  type AnswerSubmitResponse,
  type Evidence,
  type JobState,
  type GenerationJob,
} from "@point-nemo/shared";

export {
  type DescentRun,
  type DescentZone,
  type PointNemoQuestion,
  type QuestionAttempt,
  type QuestionSet,
  type RunDetail,
  type AnswerFeedback,
  type ActiveQuestion,
  type CurrentSlot,
  type RunAttemptDetail,
  type AnswerSubmitResponse,
  type Evidence,
  type JobState,
  type GenerationJob,
};

export interface ServiceStatus {
  available: boolean;
  model?: string;
  message: string;
}

export interface AppStatus {
  api: ServiceStatus;
  ai: ServiceStatus;
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface ApiHealthResponse {
  status: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string = "API_ERROR",
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errPayload: any;
    try {
      errPayload = await response.json();
    } catch {
      // not JSON
    }
    const message = errPayload?.error?.message || `Request failed with HTTP ${response.status}.`;
    const code = errPayload?.error?.code || "HTTP_ERROR";
    throw new ApiRequestError(message, code, response.status);
  }
  return (await response.json()) as T;
}

async function getJson<T>(path: string, timeoutMs = 5000): Promise<T> {
  const response = await fetch(path, { signal: AbortSignal.timeout(timeoutMs) });
  return handleResponse<T>(response);
}

// ============================================================================
// AUTHORITATIVE BACKEND REST CLIENT
// ============================================================================

/**
 * Upload a PDF to the authoritative Express backend.
 * Uses FormData with field name "file".
 */
export async function uploadDocument(file: File): Promise<{ documentId: string; jobId: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/documents", {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(15_000),
  });

  const body = await handleResponse<ApiEnvelope<{ documentId: string; jobId: string }>>(response);
  return body.data;
}

/**
 * Poll job status until "ready", "failed", or "cancelled".
 */
export async function getGenerationJob(jobId: string): Promise<GenerationJob> {
  const body = await getJson<ApiEnvelope<GenerationJob>>(`/api/jobs/${jobId}`, 5_000);
  return body.data;
}

/**
 * Fetch the validated question set (3 topics, 9 questions).
 */
export async function getQuestionSet(questionSetId: string): Promise<QuestionSet> {
  const body = await getJson<ApiEnvelope<QuestionSet>>(`/api/question-sets/${questionSetId}`, 5_000);
  return body.data;
}

/**
 * Create a new authoritative game run (18 fixed slots).
 */
export async function createRun(questionSetId: string): Promise<RunDetail> {
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionSetId }),
    signal: AbortSignal.timeout(5_000),
  });
  const body = await handleResponse<ApiEnvelope<RunDetail>>(response);
  return body.data;
}

/**
 * Get authoritative run snapshot.
 */
export async function getRun(runId: string): Promise<RunDetail> {
  const body = await getJson<ApiEnvelope<RunDetail>>(`/api/runs/${runId}`, 5_000);
  return body.data;
}

/**
 * Submit an answer to the backend authoritative run engine.
 */
export async function submitAnswer(
  runId: string,
  slotId: string,
  selectedOptionIndex: number,
): Promise<AnswerSubmitResponse> {
  const response = await fetch(`/api/runs/${runId}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slotId, selectedOptionIndex }),
    signal: AbortSignal.timeout(5_000),
  });
  const body = await handleResponse<ApiEnvelope<AnswerSubmitResponse>>(response);
  return body.data;
}

/**
 * Check Express API health and local Ollama readiness.
 */
export async function getAppStatus(): Promise<AppStatus> {
  const [healthResult, aiResult] = await Promise.allSettled([
    fetch("/api/health", { signal: AbortSignal.timeout(3500) }).then((r) => r.json() as Promise<ApiHealthResponse>),
    fetch("/api/ai/status", { signal: AbortSignal.timeout(3500) }).then((r) => r.json() as Promise<ServiceStatus>),
  ]);

  if (healthResult.status === "rejected") {
    return {
      api: { available: false, message: "Local Express API offline." },
      ai: { available: false, message: "AI status unavailable." },
    };
  }

  return {
    api: {
      available: healthResult.value.status === "ok",
      message: healthResult.value.status === "ok" ? "Local API connected." : "API status abnormal.",
    },
    ai:
      aiResult.status === "fulfilled"
        ? aiResult.value
        : { available: false, message: "Could not connect to Ollama." },
  };
}

// ============================================================================
// DESCENT RUN COMPATIBILITY ADAPTERS (For LocalLibrary, DescentEncounter, ResultsScreen)
// ============================================================================

export function toPointNemoQuestion(q: any, topicName: string): PointNemoQuestion {
  const sourcePage = q.evidence?.[0]?.pageNumber ?? q.sourcePage ?? 1;
  const sourceQuote = q.evidence?.[0]?.quote ?? q.sourceQuote ?? "";
  return {
    id: q.id,
    topic: topicName || q.topic || "Marine Biology",
    difficulty: q.difficulty,
    prompt: q.prompt,
    options: (q.options || []) as [string, string, string, string],
    answerIndex: (q.answerIndex ?? 0) as 0 | 1 | 2 | 3,
    explanation: q.explanation || "",
    sourceQuote,
    sourcePage,
  };
}

export function toDescentRun(
  runDetail: RunDetail,
  questionSet?: QuestionSet,
  docName: string = "Ocean Document.pdf",
): DescentRun {
  let stage: DescentZone = "surface";
  if (runDetail.state !== "active") {
    stage = "results";
  } else if (runDetail.currentSlot) {
    stage = runDetail.currentSlot.encounterType;
  } else if (runDetail.currentSlotIndex >= 9) {
    stage = "boss";
  } else if (runDetail.currentSlotIndex >= 6) {
    stage = "midnight";
  } else if (runDetail.currentSlotIndex >= 3) {
    stage = "twilight";
  }

  let currentQuestionIndex = 0;
  if (stage === "surface") currentQuestionIndex = runDetail.currentSlotIndex;
  else if (stage === "twilight") currentQuestionIndex = Math.max(0, runDetail.currentSlotIndex - 3);
  else if (stage === "midnight") currentQuestionIndex = Math.max(0, runDetail.currentSlotIndex - 6);
  else if (stage === "boss") currentQuestionIndex = Math.max(0, runDetail.currentSlotIndex - 9);

  const attempts: QuestionAttempt[] = (runDetail.attempts || []).map((att) => ({
    questionId: att.slotId,
    slotIndex: att.slotIndex,
    zone: att.encounterType as DescentZone,
    selectedAnswer: att.selectedOptionIndex as 0 | 1 | 2 | 3,
    isCorrect: att.isCorrect,
    answeredAt: att.createdAt,
  }));

  const surfaceCorrect = attempts.filter((a) => a.zone === "surface" && a.isCorrect).length;
  const twilightCorrect = attempts.filter((a) => a.zone === "twilight" && a.isCorrect).length;
  const midnightCorrect = attempts.filter((a) => a.zone === "midnight" && a.isCorrect).length;
  const bossCorrect = attempts.filter((a) => a.zone === "boss" && a.isCorrect).length;

  let failureReason: string | undefined;
  if (runDetail.state === "failed") {
    if (runDetail.playerHp <= 0) {
      failureReason = "Hull integrity depleted (0% HP).";
    } else if (runDetail.currentSlotIndex === 3 && surfaceCorrect < 2) {
      failureReason = "Surface threshold missed (at least 2/3 required).";
    } else if (runDetail.currentSlotIndex === 6 && twilightCorrect < 2) {
      failureReason = "Twilight threshold missed (at least 2/3 required).";
    } else if (runDetail.currentSlotIndex === 9 && midnightCorrect < 2) {
      failureReason = "Midnight threshold missed (at least 2/3 required).";
    } else if (runDetail.currentSlotIndex === 18 && bossCorrect < 8) {
      failureReason = "Megalodon review threshold missed (at least 8/9 required).";
    } else {
      failureReason = "Descent threshold not reached.";
    }
  }

  // Shuffled boss order question IDs
  const qList = questionSet && "questions" in questionSet ? questionSet.questions : [];
  const shuffledBossOrder = qList.map((q: any) => q.id).slice(0, 9);
  while (shuffledBossOrder.length < 9) {
    shuffledBossOrder.push(`q-${shuffledBossOrder.length + 1}`);
  }

  return {
    id: runDetail.id,
    questionSetId: runDetail.questionSetId,
    documentName: docName,
    stage,
    status: runDetail.state,
    currentQuestionIndex,
    playerHp: runDetail.playerHp,
    enemyHp: runDetail.currentEncounterHp,
    xp: runDetail.xp,
    shuffledBossOrder,
    attempts,
    zoneScores: {
      surface: surfaceCorrect,
      twilight: twilightCorrect,
      midnight: midnightCorrect,
      boss: bossCorrect,
    },
    failureReason,
    createdAt: runDetail.createdAt,
    updatedAt: runDetail.createdAt,
  };
}

/**
 * Fetch all runs and question sets for LocalLibrary.
 */
export async function fetchRuns(): Promise<{ runs: DescentRun[]; questionSets: QuestionSet[] }> {
  try {
    const runsRes = await fetch("/api/runs");
    const json = (await runsRes.json()) as ApiEnvelope<RunDetail[]>;
    if (!runsRes.ok || !json.success) {
      return { runs: [], questionSets: [] };
    }

    const runsList = json.data;
    const questionSetsMap = new Map<string, QuestionSet>();

    // Fetch question sets for each run
    for (const r of runsList) {
      if (!questionSetsMap.has(r.questionSetId)) {
        try {
          const qs = await getQuestionSet(r.questionSetId);
          questionSetsMap.set(r.questionSetId, qs);
        } catch {
          // ignore
        }
      }
    }

    const descentRuns: DescentRun[] = runsList.map((r) => {
      const qs = questionSetsMap.get(r.questionSetId);
      return toDescentRun(r, qs);
    });

    return {
      runs: descentRuns,
      questionSets: Array.from(questionSetsMap.values()),
    };
  } catch {
    return { runs: [], questionSets: [] };
  }
}

export async function fetchRun(id: string): Promise<{ run: DescentRun; questionSet: QuestionSet }> {
  const runDetail = await getRun(id);
  const questionSet = await getQuestionSet(runDetail.questionSetId);
  return {
    run: toDescentRun(runDetail, questionSet),
    questionSet,
  };
}

export async function submitRunAnswer(
  runId: string,
  selectedAnswer: number,
): Promise<{
  run: DescentRun;
  runDetail: RunDetail;
  lastAnswer: { isCorrect: boolean; activeQuestion: PointNemoQuestion; selectedAnswer: number };
}> {
  const currentRunDetail = await getRun(runId);
  if (!currentRunDetail.currentSlot) {
    throw new Error("No active question slot in this run.");
  }

  const result = await submitAnswer(
    runId,
    currentRunDetail.currentSlot.id,
    selectedAnswer,
  );

  const questionSet = await getQuestionSet(result.run.questionSetId);
  const descentRun = toDescentRun(result.run, questionSet);

  const activeQ = toPointNemoQuestion(
    currentRunDetail.currentSlot.question,
    currentRunDetail.currentSlot.question.topicName,
  );

  return {
    run: descentRun,
    runDetail: result.run,
    lastAnswer: {
      isCorrect: result.feedback.isCorrect,
      activeQuestion: activeQ,
      selectedAnswer,
    },
  };
}

export async function tryAgainRun(
  runId: string,
): Promise<{ run: DescentRun; questionSet: QuestionSet }> {
  const oldRun = await getRun(runId);
  const newRunDetail = await createRun(oldRun.questionSetId);
  const questionSet = await getQuestionSet(newRunDetail.questionSetId);
  return {
    run: toDescentRun(newRunDetail, questionSet),
    questionSet,
  };
}

export async function deleteRun(_runId: string): Promise<boolean> {
  return true;
}
