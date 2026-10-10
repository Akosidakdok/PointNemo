import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { GenerationMetadata } from "@point-nemo/shared";
import type { ApiConfig } from "../config.js";
import { PROMPT_VERSION, SCHEMA_VERSION } from "./ollama.js";

const require = createRequire(import.meta.url);
const parserPackage = JSON.parse(readFileSync(resolve(dirname(require.resolve("pdf-parse")), "../../../package.json"), "utf8")) as {version:string};
export const EXTRACTOR_VERSION = `pdf-parse@${parserPackage.version}/point-nemo-text-v3`;
export function settingsHash(config: ApiConfig): string {
  return createHash("sha256").update(JSON.stringify({ model: config.ollamaModel, num_ctx: config.ollamaNumCtx,
    input: config.ollamaMaxInputTokens, num_predict: config.ollamaMaxOutputTokens, reserved: 1024,
    temperature: 0.2, seedPolicy: config.generationSeed === undefined ? "random-per-job-v1" : "fixed-v1", seed: config.generationSeed, repairTemperature: 0.3,
    reviewEnabled:config.reviewEnabled ?? false,
    raw: true, inferenceTimeoutMs: config.inferenceTimeoutMs, jobTimeoutMs: config.jobTimeoutMs,
  })).digest("hex");
}
export function generationMetadata(config: ApiConfig, modelDigest: string, tokenizerDigest: string, documentHash: string, createdAt = new Date().toISOString()): GenerationMetadata {
  return { documentHash, extractorVersion: EXTRACTOR_VERSION, promptVersion: PROMPT_VERSION, schemaVersion: SCHEMA_VERSION,
    tokenizerDigest, modelTag: config.ollamaModel, modelDigest, settingsHash: settingsHash(config), createdAt };
}
export function isCompatibleMetadata(metadata: GenerationMetadata, config: ApiConfig, modelDigest: string, tokenizerDigest: string): boolean {
  const expected = generationMetadata(config, modelDigest, tokenizerDigest, metadata.documentHash, metadata.createdAt);
  return Boolean(modelDigest && tokenizerDigest && metadata.documentHash && Object.entries(expected).every(([key, value]) => metadata[key as keyof GenerationMetadata] === value));
}

// Runtime tuning affects fresh-generation cache keys, not immutable saved quizzes.
export function isPlayableMetadata(metadata: GenerationMetadata, sourceHash: string): boolean {
  return metadata.documentHash === sourceHash && metadata.schemaVersion === SCHEMA_VERSION &&
    Object.values(metadata).every((value) => Boolean(value) && value !== "legacy-incompatible");
}
