import { config as loadEnv } from "dotenv";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const projectEnvPath = join(projectRoot, ".env");
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
  ollamaKeepAlive?: string;
  generationSeed?: number;
  reviewEnabled?: boolean;
}

function readPort(value: string | undefined): number {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  const number = Number(value ?? fallback);
  if (!Number.isSafeInteger(number) || number < 1 || number > fallback) {
    throw new Error(`${name} must be an integer between 1 and ${fallback}.`);
  }
  return number;
}

function localOllamaUrl(value: string | undefined): string {
  let url: URL;
  try {
    url = new URL(value ?? "http://127.0.0.1:11434");
  } catch {
    throw new Error("OLLAMA_BASE_URL must be a loopback HTTP URL.");
  }
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username || url.password || url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("OLLAMA_BASE_URL must be a loopback HTTP URL without credentials or a path.");
  }
  // Avoid resolving a configurable hostname for inference.
  if (url.hostname === "localhost") url.hostname = "127.0.0.1";
  return url.href.replace(/\/$/, "");
}

function defaultDatabasePath(environment: NodeJS.ProcessEnv): string {
  const userDirectory = environment.USERPROFILE || homedir();
  const appData = process.platform === "win32"
    ? environment.LOCALAPPDATA || join(userDirectory, "AppData", "Local")
    : process.platform === "darwin"
      ? join(userDirectory, "Library", "Application Support")
      : environment.XDG_DATA_HOME || join(userDirectory, ".local", "share");
  return join(appData, "PointNemo", "point-nemo.sqlite");
}

export function readConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const model = environment.OLLAMA_MODEL || "qwen2.5:3b";
  if (!["qwen2.5:1.5b", "qwen2.5:3b"].includes(model)) {
    throw new Error("OLLAMA_MODEL must be qwen2.5:1.5b or qwen2.5:3b (the supported Qwen tokenizer family).");
  }
  const numCtx = positiveInteger(environment.OLLAMA_NUM_CTX, 8192, "OLLAMA_NUM_CTX");
  const maxInput = positiveInteger(environment.OLLAMA_MAX_INPUT_TOKENS, 4096, "OLLAMA_MAX_INPUT_TOKENS");
  const maxOutput = positiveInteger(environment.OLLAMA_MAX_OUTPUT_TOKENS, 3072, "OLLAMA_MAX_OUTPUT_TOKENS");
  const keepAlive = environment.OLLAMA_KEEP_ALIVE?.trim() || "30m";
  const generationSeed = environment.OLLAMA_SEED === undefined ? undefined : Number(environment.OLLAMA_SEED);
  if (environment.OLLAMA_REVIEW !== undefined && !["0","1"].includes(environment.OLLAMA_REVIEW)) throw new Error("OLLAMA_REVIEW must be 0 or 1.");
  if (generationSeed !== undefined && (!Number.isInteger(generationSeed) || generationSeed < 0 || generationSeed > 2_000_000_000)) throw new Error("OLLAMA_SEED must be an integer from 0 to 2000000000.");
  if (!/^(?:0|[1-9]\d*(?:ms|s|m|h))$/.test(keepAlive)) throw new Error("OLLAMA_KEEP_ALIVE must be 0 or a positive duration such as 30m.");
  if (maxInput + maxOutput + 1024 > numCtx) {
    throw new Error("The input/output token budgets and 1024-token reserve must fit OLLAMA_NUM_CTX.");
  }
  return {
    port: readPort(environment.API_PORT),
    databasePath: environment.DATABASE_PATH?.trim()
      ? resolve(projectRoot, environment.DATABASE_PATH)
      : resolve(defaultDatabasePath(environment)),
    ollamaBaseUrl: localOllamaUrl(environment.OLLAMA_BASE_URL),
    ollamaModel: model,
    ollamaKeepAlive: keepAlive,
    generationSeed,
    reviewEnabled: environment.OLLAMA_REVIEW === "1",
    ollamaNumCtx: numCtx,
    ollamaMaxInputTokens: maxInput,
    ollamaMaxOutputTokens: maxOutput,
    inferenceTimeoutMs: positiveInteger(environment.INFERENCE_TIMEOUT_MS, 180000, "INFERENCE_TIMEOUT_MS"),
    jobTimeoutMs: positiveInteger(environment.JOB_TIMEOUT_MS, 360000, "JOB_TIMEOUT_MS"),
  };
}
