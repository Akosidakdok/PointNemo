import {
  GeneratedQuestionResponseSchema,
  type GeneratedQuestion,
  type StudyContent,
} from "@point-nemo/shared";
import type { ApiConfig } from "../config.js";
import { ServiceUnavailableError } from "../errors.js";

export interface OllamaStatus {
  available: boolean;
  model: string;
  message: string;
}

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

export class OllamaService {
  constructor(private readonly config: Pick<ApiConfig, "ollamaBaseUrl" | "ollamaModel">) {}

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

      return {
        available: true,
        model: this.config.ollamaModel,
        message: `Ollama is reachable. Configure or pull ${this.config.ollamaModel} before generating study content.`,
      };
    } catch {
      return {
        available: false,
        model: this.config.ollamaModel,
        message: `Ollama is not reachable at ${this.config.ollamaBaseUrl}. Start Ollama or update OLLAMA_BASE_URL; set OLLAMA_MODEL to the model you benchmark.`,
      };
    }
  }

  async generateQuestions(input: StudyContent): Promise<GeneratedQuestion[]> {
    let response: Response;
    try {
      response = await fetch(`${this.config.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          model: this.config.ollamaModel,
          stream: false,
          format: "json",
          messages: [
            {
              role: "system",
              content: "Create three multiple-choice study questions. Return a JSON object with a questions array. Each question must have id (UUID), prompt, options (at least two strings), answerIndex (zero-based integer), and explanation.",
            },
            { role: "user", content: JSON.stringify(input) },
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

    return GeneratedQuestionResponseSchema.parse(generated).questions;
  }

  async chat(systemPrompt: string, userMessage: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.config.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({
          model: this.config.ollamaModel,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });
    } catch {
      throw new ServiceUnavailableError(
        "OLLAMA_UNAVAILABLE",
        `Ollama is not reachable at ${this.config.ollamaBaseUrl}. Start Ollama and confirm model ${this.config.ollamaModel} is installed.`
      );
    }

    const body = (await response.json()) as OllamaChatResponse;
    if (!response.ok) {
      throw new ServiceUnavailableError(
        "OLLAMA_REQUEST_FAILED",
        body.error ?? `Ollama returned HTTP ${response.status}. Check that model ${this.config.ollamaModel} is installed.`
      );
    }

    const rawContent = body.message?.content;
    if (!rawContent) {
      throw new ServiceUnavailableError("OLLAMA_EMPTY_RESPONSE", "Ollama returned no message content.");
    }

    return rawContent;
  }
}
