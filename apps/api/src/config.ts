import { config as loadEnv } from "dotenv";
import { homedir } from "node:os";
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
  const appDataDirectory = process.platform === "win32"
    ? environment.LOCALAPPDATA ?? resolve(homedir(), "AppData", "Local")
    : environment.XDG_DATA_HOME ?? resolve(homedir(), ".local", "share");
  const databasePath = environment.DATABASE_PATH
    ? resolve(dirname(fileURLToPath(import.meta.url)), "../", environment.DATABASE_PATH)
    : resolve(appDataDirectory, "PointNemo", "point-nemo.sqlite");
  return {
    port: readPort(environment.API_PORT),
    databasePath,
    ollamaBaseUrl: (environment.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, ""),
    ollamaModel: environment.OLLAMA_MODEL ?? "qwen2.5:1.5b",
  };
}
