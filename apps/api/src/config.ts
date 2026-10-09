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
    ollamaBaseUrl: (environment.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, ""),
    ollamaModel: environment.OLLAMA_MODEL ?? "qwen3:4b",
  };
}
