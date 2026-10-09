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

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { signal: AbortSignal.timeout(3500) });
  if (!response.ok) {
    throw new Error(`The local API returned HTTP ${response.status}.`);
  }
  return response.json() as Promise<T>;
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
