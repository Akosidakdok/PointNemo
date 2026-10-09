import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env");
loadEnv({ path: projectEnvPath });

export interface ApiConfig {
  port: number;
  databasePath: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaNumCtx: number;
  ollamaMaxInputTokens: number;
  ollamaMaxOutputTokens: number;
  inferenceTimeoutMs: number;
  jobTimeoutMs: number;
}

function readPort(value: string | undefined): number {
  const port = Number(value ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be an integer between 1 and 65535.");
  }
  return port;
}

export function readConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    port: readPort(environment.API_PORT),
    databasePath: resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../",
      environment.DATABASE_PATH ?? "data/point-nemo.sqlite",
    ),
    ollamaBaseUrl: (environment.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, ""),
    ollamaModel: environment.OLLAMA_MODEL ?? "qwen2.5:1.5b",
    ollamaNumCtx: Number(environment.OLLAMA_NUM_CTX ?? 8192),
    ollamaMaxInputTokens: Number(environment.OLLAMA_MAX_INPUT_TOKENS ?? 4096),
    ollamaMaxOutputTokens: Number(environment.OLLAMA_MAX_OUTPUT_TOKENS ?? 3072),
    inferenceTimeoutMs: Number(environment.INFERENCE_TIMEOUT_MS ?? 40000),
    jobTimeoutMs: Number(environment.JOB_TIMEOUT_MS ?? 90000),
  };
}
