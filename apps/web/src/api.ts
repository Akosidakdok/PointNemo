import {
  type ExtractedDocument,
  type QuestionSet,
  type DescentRun,
  type PointNemoQuestion,
} from "@point-nemo/shared";

export interface ServiceStatus {
  available: boolean;
  model?: string;
  message: string;
}

export interface AppStatus {
  api: ServiceStatus;
  ai: ServiceStatus;
}

interface ApiHealthResponse {
  status: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string = "API_ERROR",
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
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
  return response.json() as Promise<T>;
}

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

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/documents/extract", {
    method: "POST",
    body: formData,
  });

  const data = await handleResponse<{ document: ExtractedDocument }>(response);
  return data.document;
}

export async function generateQuestionSet(
  document: ExtractedDocument
): Promise<{ questionSet: QuestionSet; run: DescentRun }> {
  const response = await fetch("/api/documents/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document }),
  });

  return handleResponse<{ questionSet: QuestionSet; run: DescentRun }>(response);
}

export async function fetchRuns(): Promise<{ runs: DescentRun[]; questionSets: QuestionSet[] }> {
  const response = await fetch("/api/runs");
  return handleResponse<{ runs: DescentRun[]; questionSets: QuestionSet[] }>(response);
}

export async function fetchRun(id: string): Promise<{ run: DescentRun; questionSet: QuestionSet }> {
  const response = await fetch(`/api/runs/${id}`);
  return handleResponse<{ run: DescentRun; questionSet: QuestionSet }>(response);
}

export async function submitRunAnswer(
  runId: string,
  selectedAnswer: number
): Promise<{
  run: DescentRun;
  lastAnswer: { isCorrect: boolean; activeQuestion: PointNemoQuestion; selectedAnswer: number };
}> {
  const response = await fetch(`/api/runs/${runId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selectedAnswer }),
  });

  return handleResponse<{
    run: DescentRun;
    lastAnswer: { isCorrect: boolean; activeQuestion: PointNemoQuestion; selectedAnswer: number };
  }>(response);
}

export async function tryAgainRun(
  runId: string
): Promise<{ run: DescentRun; questionSet: QuestionSet }> {
  const response = await fetch(`/api/runs/${runId}/try-again`, {
    method: "POST",
  });

  return handleResponse<{ run: DescentRun; questionSet: QuestionSet }>(response);
}

export async function deleteRun(runId: string): Promise<boolean> {
  const response = await fetch(`/api/runs/${runId}`, {
    method: "DELETE",
  });

  const data = await handleResponse<{ success: boolean }>(response);
  return data.success;
}
