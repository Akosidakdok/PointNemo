import {
  AIQuestionSetOutputSchema,
} from "@point-nemo/shared";
import type { z } from "zod";
import type { ApiConfig } from "../config.js";
import { ServiceUnavailableError } from "../errors.js";

type AIQuestionSetOutput = z.infer<typeof AIQuestionSetOutputSchema>;

export interface OllamaStatus {
  available: boolean;
  model: string;
  message: string;
}

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

const questionSetJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["topics", "questions"],
  properties: {
    topics: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: { name: { type: "string", minLength: 1 } },
      },
    },
    questions: {
      type: "array",
      minItems: 9,
      maxItems: 9,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topicName", "difficulty", "prompt", "options", "answerIndex", "explanation", "evidence"],
        properties: {
          topicName: { type: "string", minLength: 1 },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          prompt: { type: "string", minLength: 1, maxLength: 300 },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string", minLength: 1, maxLength: 160 },
          },
          answerIndex: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string", minLength: 1, maxLength: 600 },
          evidence: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["pageNumber", "chunkId", "quote"],
              properties: {
                pageNumber: { type: "integer", minimum: 1 },
                chunkId: { type: "string", minLength: 1 },
                quote: { type: "string", minLength: 20, maxLength: 400 },
              },
            },
          },
        },
      },
    },
  },
} as const;

export class OllamaService {
  constructor(private readonly config: Pick<ApiConfig, "ollamaBaseUrl" | "ollamaModel" | "ollamaNumCtx" | "ollamaMaxOutputTokens" | "inferenceTimeoutMs">) {}

  async getStatus(): Promise<OllamaStatus> {
    try {
      const response = await fetch(`${this.config.ollamaBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) {
        return {
          available: false,
          model: this.config.ollamaModel,
          message: `Ollama returned HTTP ${response.status}. Start Ollama and check OLLAMA_BASE_URL.`,
        };
      }

      const body = await response.json() as { models?: Array<{ name?: string }> };
      const hasModel = body.models?.some((model) => model.name === this.config.ollamaModel);
      return {
        available: Boolean(hasModel),
        model: this.config.ollamaModel,
        message: hasModel
          ? `Ollama is ready with ${this.config.ollamaModel}.`
          : `Ollama is reachable, but ${this.config.ollamaModel} is not installed. Pull the configured model before generating study content.`,
      };
    } catch {
      return {
        available: false,
        model: this.config.ollamaModel,
        message: `Ollama is not reachable at ${this.config.ollamaBaseUrl}. Start Ollama or update OLLAMA_BASE_URL; set OLLAMA_MODEL to the model you benchmark.`,
      };
    }
  }

  async generateQuestions(input: string): Promise<AIQuestionSetOutput> {
    let response: Response;
    try {
      response = await fetch(`${this.config.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(this.config.inferenceTimeoutMs),
        body: JSON.stringify({
          model: this.config.ollamaModel,
          stream: false,
          format: questionSetJsonSchema,
          options: {
            num_ctx: this.config.ollamaNumCtx,
            num_predict: this.config.ollamaMaxOutputTokens,
            temperature: 0,
          },
          messages: [
            {
              role: "system",
              content: "Create exactly three distinct topics and exactly nine source-grounded multiple-choice questions. Create one easy, one medium, and one hard question for each topic. Use only the supplied source text. Each question must have exactly four options, one answerIndex from 0 to 3, a concise explanation, and one or two exact supporting quotes with pageNumber and chunkId.",
            },
            { role: "user", content: input },
          ],
        }),
      });
    } catch {
      throw new ServiceUnavailableError(
        "OLLAMA_UNAVAILABLE",
        `Ollama is not reachable at ${this.config.ollamaBaseUrl}. Start Ollama and confirm model ${this.config.ollamaModel} is installed.`,
      );
    }

    const body = await response.json() as OllamaChatResponse;
    if (!response.ok) {
      throw new ServiceUnavailableError(
        "OLLAMA_REQUEST_FAILED",
        body.error ?? `Ollama returned HTTP ${response.status}. Check that model ${this.config.ollamaModel} is installed.`,
      );
    }

    const rawContent = body.message?.content;
    if (!rawContent) {
      throw new ServiceUnavailableError("OLLAMA_EMPTY_RESPONSE", "Ollama returned no question data.");
    }

    let generated: unknown;
    try {
      generated = JSON.parse(rawContent);
    } catch {
      throw new ServiceUnavailableError("OLLAMA_INVALID_JSON", "Ollama returned malformed JSON; try the request again or select a different model.");
    }

    return AIQuestionSetOutputSchema.parse(generated);
  }
}
