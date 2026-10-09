export interface ServiceStatus {
  available: boolean;
  model?: string;
  message: string;
}

export interface AppStatus {
  api: ServiceStatus;
  ai: ServiceStatus;
}

export type JobState = "extracting" | "generating" | "validating" | "ready" | "failed" | "cancelled";

export interface GenerationJob {
  id: string;
  documentId: string;
  state: JobState;
  questionSetId?: string;
  errorCode?: string;
  elapsedTimeMs?: number;
  createdAt: string;
}

export interface QuestionSet {
  id: string;
  documentId: string;
  topics: Array<{ id: string; name: string }>;
  questions: Array<{
    id: string;
    topicId: string;
    difficulty: "easy" | "medium" | "hard";
    prompt: string;
    options: string[];
    answerIndex: number;
    explanation: string;
    evidence: Array<{ pageNumber: number; chunkId: string; quote: string }>;
  }>;
  createdAt: string;
}

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface ApiHealthResponse {
  status: string;
}

async function getJson<T>(path: string, timeoutMs = 3500): Promise<T> {
  const response = await fetch(path, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`The local API returned HTTP ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export async function uploadDocument(file: File): Promise<{ documentId: string; jobId: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/documents", {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json() as ApiEnvelope<{ documentId: string; jobId: string }> | { error?: { message?: string } };
  if (!response.ok || !("success" in body)) {
    throw new Error("error" in body ? body.error?.message ?? "The document could not be uploaded." : "The document could not be uploaded.");
  }
  return body.data;
}

export async function getGenerationJob(jobId: string): Promise<GenerationJob> {
  const body = await getJson<ApiEnvelope<GenerationJob>>(`/api/jobs/${jobId}`, 5_000);
  return body.data;
}

export async function getQuestionSet(questionSetId: string): Promise<QuestionSet> {
  const body = await getJson<ApiEnvelope<QuestionSet>>(`/api/question-sets/${questionSetId}`, 5_000);
  return body.data;
}

export async function getAppStatus(): Promise<AppStatus> {
  const [healthResult, aiResult] = await Promise.allSettled([
    getJson<ApiHealthResponse>("/api/health"),
    getJson<ServiceStatus>("/api/ai/status"),
  ]);

  if (healthResult.status === "rejected") {
    return {
      api: { available: false, message: "API offline — start the local Express service." },
      ai: { available: false, message: "AI status is unavailable until the API is running." },
    };
  }

  if (healthResult.value.status !== "ok") {
    return {
      api: { available: false, message: "The local API returned an unexpected health response." },
      ai: aiResult.status === "fulfilled"
        ? aiResult.value
        : { available: false, message: "AI status could not be loaded." },
    };
  }

  return {
    api: { available: true, message: "Local API connected." },
    ai: aiResult.status === "fulfilled"
      ? aiResult.value
      : { available: false, message: "AI status could not be loaded. Check the API and Ollama setup." },
  };
}


export interface Evidence {
  pageNumber: number;
  chunkId: string;
  quote: string;
}

export interface AnswerFeedback {
  isCorrect: boolean;
  correctAnswerIndex: number;
  explanation: string;
  evidence: Evidence[];
  playerDamageTaken: number;
  enemyDamageTaken: number;
  xpAwarded: number;
}

export interface ActiveQuestion {
  id: string;
  topicId: string;
  topicName: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: string[];
}

export interface CurrentSlot {
  id: string;
  slotIndex: number;
  encounterType: "surface" | "twilight" | "midnight" | "boss";
  question: ActiveQuestion;
}

export interface RunAttemptDetail {
  id: string;
  slotId: string;
  slotIndex: number;
  encounterType: "surface" | "twilight" | "midnight" | "boss";
  selectedOptionIndex: number;
  isCorrect: boolean;
  feedback: AnswerFeedback;
  questionPrompt: string;
  topicName: string;
  createdAt: string;
}

export interface RunDetail {
  id: string;
  questionSetId: string;
  state: "active" | "completed" | "failed";
  playerHp: number;
  currentEncounterHp: number;
  xp: number;
  combo: number;
  currentSlotIndex: number;
  rulesVersion: string;
  createdAt: string;
  currentSlot?: CurrentSlot;
  latestFeedback?: AnswerFeedback;
  attempts?: RunAttemptDetail[];
}

export interface AnswerSubmitResponse {
  feedback: AnswerFeedback;
  run: RunDetail;
}

export async function createRun(questionSetId: string): Promise<RunDetail> {
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionSetId }),
    signal: AbortSignal.timeout(5_000),
  });
  const body = (await response.json()) as ApiEnvelope<RunDetail> | { error?: { message?: string } };
  if (!response.ok || !("success" in body)) {
    throw new Error("error" in body ? body.error?.message ?? "Could not create run." : "Could not create run.");
  }
  return body.data;
}

export async function getRun(runId: string): Promise<RunDetail> {
  const body = await getJson<ApiEnvelope<RunDetail>>(`/api/runs/${runId}`, 5_000);
  return body.data;
}

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
  const body = (await response.json()) as ApiEnvelope<AnswerSubmitResponse> | { error?: { message?: string } };
  if (!response.ok || !("success" in body)) {
    throw new Error("error" in body ? body.error?.message ?? "Could not submit answer." : "Could not submit answer.");
  }
  return body.data;
}
