import {
  type ExtractedDocument,
  type PointNemoQuestion,
  type QuestionSet,
} from "@point-nemo/shared";
import type { OllamaService } from "./ollama.js";
import { ValidationError } from "../errors.js";
import { randomUUID } from "node:crypto";

interface RawAiQuestion {
  topic?: string;
  difficulty?: string;
  prompt?: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string;
  sourceQuote?: string;
  sourcePage?: number;
}

interface RawAiResponse {
  topics?: string[];
  questions?: RawAiQuestion[];
}

export class QuestionGeneratorService {
  constructor(private readonly ollama: OllamaService) {}

  async generateAndValidate(doc: ExtractedDocument, maxRetries = 2): Promise<QuestionSet> {
    let lastError = "Failed to generate valid question set";

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const rawJson = await this.callOllama(doc);
        const validated = this.validateCandidate(rawJson, doc);
        return {
          id: randomUUID(),
          documentName: doc.filename,
          topics: validated.topics,
          questions: validated.questions,
          extractedPages: doc.pages,
          createdAt: new Date().toISOString(),
        };
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`[Generation] Attempt ${attempt} failed:`, lastError);
      }
    }

    throw new ValidationError(
      `Point Nemo could not create 9 reliable source-grounded questions from this PDF. Details: ${lastError}`
    );
  }

  private async callOllama(doc: ExtractedDocument): Promise<RawAiResponse> {
    // For very large documents, cap total page content passed to Ollama at ~25,000 characters to protect LLM context
    let formattedPages = doc.pages.map((p: any) => `--- PAGE ${p.pageNumber} ---\n${p.text}`);
    let pagesSummary = formattedPages.join("\n\n");
    if (pagesSummary.length > 25000) {
      // Sample evenly across pages
      const maxCharsPerPage = Math.floor(25000 / doc.pages.length);
      pagesSummary = doc.pages
        .map((p: any) => {
          const pageExcerpt = p.text.length > maxCharsPerPage ? p.text.slice(0, maxCharsPerPage) + "..." : p.text;
          return `--- PAGE ${p.pageNumber} ---\n${pageExcerpt}`;
        })
        .join("\n\n");
    }

    const systemPrompt = `You are a rigorous educational exam creator.
Analyze the provided document text and create an educational study set of EXACTLY 9 source-grounded multiple-choice questions.

CRITICAL REQUIREMENTS:
1. Identify EXACTLY 3 distinct educational topics from the text.
2. For EACH of the 3 topics, create EXACTLY 3 questions: 1 easy, 1 medium, 1 hard.
3. Total questions MUST be EXACTLY 9.
4. Each question must have:
   - topic: The name of the topic (must be one of the 3 identified topics)
   - difficulty: "easy", "medium", or "hard"
   - prompt: Clear, unambiguous question statement
   - options: Array of EXACTLY 4 distinct choices (strings)
   - answerIndex: Zero-based integer (0, 1, 2, or 3) indicating the correct option
   - explanation: 1-2 sentences explaining why the answer is correct
   - sourceQuote: Verbatim sentence or exact phrase from the source text supporting the answer
   - sourcePage: Integer (between 1 and ${doc.pageCount}) indicating the exact page where the sourceQuote appears

Return ONLY valid JSON matching this exact structure:
{
  "topics": ["Topic 1", "Topic 2", "Topic 3"],
  "questions": [
    {
      "topic": "Topic 1",
      "difficulty": "easy",
      "prompt": "...",
      "options": ["A", "B", "C", "D"],
      "answerIndex": 0,
      "explanation": "...",
      "sourceQuote": "...",
      "sourcePage": 1
    }
  ]
}`;

    const userMessage = `DOCUMENT TEXT:\n${pagesSummary}\n\nGenerate the 9 source-grounded questions now in JSON.`;

    const rawResponse = await this.ollama.chat(systemPrompt, userMessage);
    try {
      return JSON.parse(rawResponse) as RawAiResponse;
    } catch {
      // Try stripping markdown blocks if any
      const cleaned = rawResponse
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();
      return JSON.parse(cleaned) as RawAiResponse;
    }
  }

  validateCandidate(
    raw: RawAiResponse,
    doc: ExtractedDocument
  ): { topics: [string, string, string]; questions: PointNemoQuestion[] } {
    if (!raw || typeof raw !== "object") {
      throw new Error("AI returned malformed or non-object response.");
    }

    if (!Array.isArray(raw.questions)) {
      throw new Error("Missing 'questions' array in AI response.");
    }

    // 1. Total questions count = exactly 9
    if (raw.questions.length !== 9) {
      throw new Error(`Expected exactly 9 questions, received ${raw.questions.length}.`);
    }

    // 2. Identify and validate topics
    const rawTopics = Array.isArray(raw.topics) ? raw.topics.map((t) => String(t).trim()).filter(Boolean) : [];
    const questionTopics = Array.from(new Set(raw.questions.map((q) => String(q.topic ?? "").trim()).filter(Boolean)));
    const allTopics = Array.from(new Set([...rawTopics, ...questionTopics]));

    if (allTopics.length < 3) {
      throw new Error(`Expected at least 3 distinct topics, found ${allTopics.length}.`);
    }
    const chosenTopics: [string, string, string] = [allTopics[0], allTopics[1], allTopics[2]];

    // 3. Difficulty coverage: 3 easy, 3 medium, 3 hard
    const difficulties = raw.questions.map((q) => String(q.difficulty ?? "").toLowerCase());
    const easyCount = difficulties.filter((d) => d === "easy").length;
    const medCount = difficulties.filter((d) => d === "medium").length;
    const hardCount = difficulties.filter((d) => d === "hard").length;

    if (easyCount !== 3 || medCount !== 3 || hardCount !== 3) {
      throw new Error(
        `Question distribution must have 3 easy, 3 medium, 3 hard (found: ${easyCount} easy, ${medCount} med, ${hardCount} hard).`
      );
    }

    // 4. Validate individual questions & quotes against extracted document
    const validatedQuestions: PointNemoQuestion[] = [];
    const seenPrompts = new Set<string>();

    for (let i = 0; i < raw.questions.length; i++) {
      const q = raw.questions[i];
      const prompt = String(q.prompt ?? "").trim();
      if (!prompt || prompt.length < 5) {
        throw new Error(`Question ${i + 1} has empty or trivial prompt.`);
      }

      const promptLower = prompt.toLowerCase();
      if (seenPrompts.has(promptLower)) {
        throw new Error(`Duplicate question prompt detected at question ${i + 1}.`);
      }
      seenPrompts.add(promptLower);

      if (!Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Question ${i + 1} must have exactly 4 choices.`);
      }

      const cleanOptions = q.options.map((opt) => String(opt).trim()) as [string, string, string, string];
      if (new Set(cleanOptions).size !== 4) {
        throw new Error(`Question ${i + 1} contains duplicate choices.`);
      }

      const answerIdx = Number(q.answerIndex);
      if (![0, 1, 2, 3].includes(answerIdx)) {
        throw new Error(`Question ${i + 1} answerIndex must be 0, 1, 2, or 3.`);
      }

      const explanation = String(q.explanation ?? "").trim();
      if (!explanation || explanation.length < 5) {
        throw new Error(`Question ${i + 1} lacks a valid explanation.`);
      }

      const sourcePage = Number(q.sourcePage);
      if (!Number.isInteger(sourcePage) || sourcePage < 1 || sourcePage > doc.pageCount) {
        throw new Error(`Question ${i + 1} references invalid source page: ${q.sourcePage}.`);
      }

      const sourceQuote = String(q.sourceQuote ?? "").trim();
      if (!sourceQuote || sourceQuote.length < 3) {
        throw new Error(`Question ${i + 1} lacks a supporting source quote.`);
      }

      // Check that source quote exists in the referenced page or document
      const targetPage = doc.pages.find((p: any) => p.pageNumber === sourcePage);
      const targetText = targetPage ? targetPage.text.toLowerCase() : doc.normalizedText.toLowerCase();
      const cleanQuote = sourceQuote.toLowerCase().replace(/["']/g, "").trim();

      // Flexible quote match: either exact substring or significant word overlap (>= 75%)
      const isExactMatch = targetText.includes(cleanQuote);
      let isFuzzyMatch = false;
      if (!isExactMatch) {
        const quoteWords = cleanQuote.split(/\s+/).filter((w) => w.length > 3);
        if (quoteWords.length >= 3) {
          const matchedWords = quoteWords.filter((w) => targetText.includes(w));
          if (matchedWords.length / quoteWords.length >= 0.75) {
            isFuzzyMatch = true;
          }
        }
      }

      if (!isExactMatch && !isFuzzyMatch) {
        throw new Error(
          `Question ${i + 1} source quote could not be verified in page ${sourcePage} text.`
        );
      }

      const difficulty = q.difficulty?.toLowerCase() as "easy" | "medium" | "hard";
      const topic = String(q.topic ?? chosenTopics[Math.floor(i / 3)]).trim();

      validatedQuestions.push({
        id: randomUUID(),
        topic: topic || chosenTopics[Math.floor(i / 3)],
        difficulty,
        prompt,
        options: cleanOptions,
        answerIndex: answerIdx as 0 | 1 | 2 | 3,
        explanation,
        sourceQuote,
        sourcePage,
      });
    }

    return {
      topics: chosenTopics,
      questions: validatedQuestions,
    };
  }
}
