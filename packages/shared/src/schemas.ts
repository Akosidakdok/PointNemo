import { z } from "zod";

export const PDF_LIMITS = { maxBytes: 5 * 1024 * 1024, maxPages: 3, maxCharacters: 8000, minNonWhitespace: 300 } as const;

// Document admission & metadata
export const DocumentSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  sha256: z.string(),
  pageCount: z.number().int().min(1),
  normalizedCharacterCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
});
export type Document = z.infer<typeof DocumentSchema>;

// Generation Job
export const JobStateSchema = z.enum([
  "extracting",
  "generating",
  "validating",
  "ready",
  "failed",
  "cancelled",
]);
export type JobState = z.infer<typeof JobStateSchema>;

export const GenerationJobSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  state: JobStateSchema,
  questionSetId: z.string().uuid().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  errorStage: z.enum(["extracting", "generating", "validating"]).optional(),
  retryCount: z.number().int().min(0).max(1).optional(),
  timings: z.record(z.string(), z.number().nonnegative()).optional(),
  elapsedTimeMs: z.number().int().min(0).optional(),
  createdAt: z.string().datetime(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;

// Evidence, Questions, Topics, QuestionSet
export const EvidenceSchema = z.object({
  pageNumber: z.number().int().min(1),
  chunkId: z.string().trim().min(1),
  quote: z.string().trim().min(20).max(400),
}).strict();
export type Evidence = z.infer<typeof EvidenceSchema>;

export const TopicSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});
export type Topic = z.infer<typeof TopicSchema>;

export const QuestionDifficultySchema = z.enum(["easy", "medium", "hard"]);
export type QuestionDifficulty = z.infer<typeof QuestionDifficultySchema>;

export const QuestionSchema = z.object({
  id: z.string().uuid(),
  topicId: z.string().uuid(),
  difficulty: QuestionDifficultySchema,
  prompt: z.string().min(1).max(300),
  options: z.array(z.string().min(1).max(160)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1).max(600),
  evidence: z.array(EvidenceSchema).min(1).max(2),
});
export type Question = z.infer<typeof QuestionSchema>;

// AI output structure
export const AIQuestionOutputSchema = z.object({
  topicName: z.string().trim().min(1).max(100),
  difficulty: QuestionDifficultySchema,
  prompt: z.string().trim().min(1).max(300),
  options: z.array(z.string().trim().min(1).max(160)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(1).max(600),
  evidence: z.array(EvidenceSchema).min(1).max(2),
}).strict();

export const AIQuestionSetOutputSchema = z.object({
  status: z.literal("ready").optional(),
  topics: z.array(z.object({
    name: z.string().trim().min(1).max(100)
  }).strict()).length(3),
  questions: z.array(AIQuestionOutputSchema).length(9),
}).strict();
export type AIQuestionSetOutput = z.infer<typeof AIQuestionSetOutputSchema>;

export const InsufficientSourceSchema = z.object({ status: z.literal("insufficient_source"), reason: z.string().trim().min(1).max(300) }).strict();

export const GenerationMetadataSchema = z.object({
  documentHash: z.string(), extractorVersion: z.string(), promptVersion: z.string(), schemaVersion: z.string(),
  tokenizerDigest: z.string(), modelTag: z.string(), modelDigest: z.string(), settingsHash: z.string(), createdAt: z.string().datetime(),
});
export type GenerationMetadata = z.infer<typeof GenerationMetadataSchema>;

export const BackendQuestionSetSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  filename: z.string().optional(),
  extractedPages: z.array(z.object({ pageNumber: z.number().int().positive(), chunkId: z.string(), text: z.string() })).optional(),
  metadata: GenerationMetadataSchema.optional(),
  compatible: z.boolean().optional(),
  topics: z.array(TopicSchema).length(3),
  questions: z.array(QuestionSchema).length(9),
  createdAt: z.string().datetime(),
});
export type BackendQuestionSet = z.infer<typeof BackendQuestionSetSchema>;


// Game state engine
export const RunStateSchema = z.enum(["active", "completed", "failed"]);
export type RunState = z.infer<typeof RunStateSchema>;

export const RunSlotSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  questionId: z.string().uuid(),
  slotIndex: z.number().int().min(0),
  encounterType: z.enum(["surface", "twilight", "midnight", "boss"]),
});
export type RunSlot = z.infer<typeof RunSlotSchema>;

export const AnswerFeedbackSchema = z.object({
  isCorrect: z.boolean(),
  correctAnswerIndex: z.number().int().min(0).max(3),
  explanation: z.string(),
  evidence: z.array(EvidenceSchema),
  playerDamageTaken: z.number().int(),
  enemyDamageTaken: z.number().int(),
  xpAwarded: z.number().int(),
});
export type AnswerFeedback = z.infer<typeof AnswerFeedbackSchema>;

export const AttemptSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  slotId: z.string().uuid(),
  selectedOptionIndex: z.number().int().min(0).max(3),
  feedback: AnswerFeedbackSchema,
  createdAt: z.string().datetime(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

export const RunSchema = z.object({
  id: z.string().uuid(),
  questionSetId: z.string().uuid(),
  state: RunStateSchema,
  playerHp: z.number().int().min(0).max(100),
  currentEncounterHp: z.number().int().min(0).max(100),
  xp: z.number().int().min(0),
  combo: z.number().int().min(0),
  currentSlotIndex: z.number().int().min(0),
  rulesVersion: z.string().default("1.0"),
  createdAt: z.string().datetime(),
});
export type Run = z.infer<typeof RunSchema>;

export const ActiveQuestionSchema = z.object({
  id: z.string().uuid(),
  topicId: z.string().uuid(),
  topicName: z.string(),
  difficulty: QuestionDifficultySchema,
  prompt: z.string().min(1).max(300),
  options: z.array(z.string().min(1).max(160)).length(4),
});
export type ActiveQuestion = z.infer<typeof ActiveQuestionSchema>;

export const CurrentSlotSchema = z.object({
  id: z.string().uuid(),
  slotIndex: z.number().int().min(0),
  encounterType: z.enum(["surface", "twilight", "midnight", "boss"]),
  question: ActiveQuestionSchema,
});
export type CurrentSlot = z.infer<typeof CurrentSlotSchema>;

export const RunAttemptDetailSchema = z.object({
  id: z.string().uuid(),
  slotId: z.string().uuid(),
  questionId: z.string().uuid().optional(),
  options: z.array(z.string()).length(4).optional(),
  slotIndex: z.number().int().min(0),
  encounterType: z.enum(["surface", "twilight", "midnight", "boss"]),
  selectedOptionIndex: z.number().int().min(0).max(3),
  isCorrect: z.boolean(),
  feedback: AnswerFeedbackSchema,
  questionPrompt: z.string(),
  topicName: z.string(),
  prompt: z.string().optional(),
  topic: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type RunAttemptDetail = z.infer<typeof RunAttemptDetailSchema>;

export const RunDetailSchema = z.object({
  id: z.string().uuid(),
  questionSetId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  filename: z.string().optional(),
  updatedAt: z.string().datetime().optional(),
  failureStage: z.enum(["surface", "twilight", "midnight", "boss"]).optional(),
  bossOrder: z.array(z.string().uuid()).length(9).optional(),
  slots: z.array(RunSlotSchema).length(18).optional(),
  state: RunStateSchema,
  status: RunStateSchema.optional(),
  documentName: z.string().optional(),
  playerHp: z.number().int().min(0).max(100),
  currentEncounterHp: z.number().int().min(0).max(100),
  xp: z.number().int().min(0),
  combo: z.number().int().min(0),
  currentSlotIndex: z.number().int().min(0),
  rulesVersion: z.string(),
  createdAt: z.string().datetime(),
  currentSlot: CurrentSlotSchema.optional(),
  latestFeedback: AnswerFeedbackSchema.optional(),
  attempts: z.array(RunAttemptDetailSchema).optional(),
});
export type RunDetail = z.infer<typeof RunDetailSchema>;

export const LibraryDocumentSchema = DocumentSchema.extend({
  updatedAt: z.string().datetime(),
  questionSets: z.array(BackendQuestionSetSchema),
  runs: z.array(RunDetailSchema),
  jobs: z.array(GenerationJobSchema),
});
export type LibraryDocument = z.infer<typeof LibraryDocumentSchema>;

export const CreateRunRequestSchema = z.object({
  questionSetId: z.string().uuid(),
});
export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;

export const SubmitAnswerRequestSchema = z.object({
  slotId: z.string().uuid(),
  selectedOptionIndex: z.number().int().min(0).max(3),
});
export type SubmitAnswerRequest = z.infer<typeof SubmitAnswerRequestSchema>;

export const AnswerSubmitResponseSchema = z.object({
  feedback: AnswerFeedbackSchema,
  run: RunDetailSchema,
});
export type AnswerSubmitResponse = z.infer<typeof AnswerSubmitResponseSchema>;

// Standard API Error
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ============================================================================
// EXTENDED UI COMPATIBILITY SCHEMAS (from front_end)
// ============================================================================

export const ExtractedPageSchema = z.object({
  pageNumber: z.number().int().min(1),
  chunkId: z.string().optional(),
  text: z.string(),
});

export const ExtractedDocumentSchema = z.object({
  filename: z.string().min(1),
  fileSize: z.number().int().min(1).max(PDF_LIMITS.maxBytes),
  pageCount: z.number().int().min(1).max(PDF_LIMITS.maxPages),
  totalCharacters: z.number().int().min(300).max(PDF_LIMITS.maxCharacters),
  pages: z.array(ExtractedPageSchema).min(1).max(PDF_LIMITS.maxPages),
  normalizedText: z.string().max(PDF_LIMITS.maxCharacters),
}).superRefine((doc, context) => {
  const normalized = doc.normalizedText.trim().replace(/\s+/g, " ");
  if (normalized.replace(/\s/g, "").length < PDF_LIMITS.minNonWhitespace) context.addIssue({ code: "custom", message: "At least 300 non-whitespace characters are required." });
  if (normalized.length !== doc.totalCharacters || doc.pages.length !== doc.pageCount) context.addIssue({ code: "custom", message: "Document counts must match the admitted source." });
});

export const PointNemoQuestionSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  prompt: z.string().min(5),
  options: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
  ]),
  answerIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  explanation: z.string().min(5),
  sourceQuote: z.string().min(3),
  sourcePage: z.number().int().min(1),
  evidence: z.array(EvidenceSchema).optional(),
});

export const FrontendQuestionSetSchema = z.object({
  id: z.string().min(1),
  documentName: z.string().min(1),
  documentId: z.string().optional(),
  compatible: z.boolean().optional(),
  metadata: GenerationMetadataSchema.optional(),
  topics: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  questions: z.array(PointNemoQuestionSchema).length(9),
  extractedPages: z.array(ExtractedPageSchema).default([]),
  createdAt: z.string(),
});
export type FrontendQuestionSet = z.infer<typeof FrontendQuestionSetSchema>;

export const QuestionSetSchema = z.union([BackendQuestionSetSchema, FrontendQuestionSetSchema]);
export type QuestionSet = z.infer<typeof QuestionSetSchema>;

export const DescentZoneEnum = z.enum(["surface", "twilight", "midnight", "boss", "results"]);
export const RunStatusEnum = z.enum(["active", "completed", "failed"]);

export const QuestionAttemptSchema = z.object({
  questionId: z.string(),
  slotIndex: z.number().int().min(0).max(18),
  zone: DescentZoneEnum,
  selectedAnswer: z.number().int().min(0).max(3),
  isCorrect: z.boolean(),
  answeredAt: z.string(),
});

export const DescentRunSchema = z.object({
  id: z.string().min(1),
  questionSetId: z.string().min(1),
  documentName: z.string().min(1),
  documentId: z.string().optional(),
  failureStage: z.enum(["surface", "twilight", "midnight", "boss"]).optional(),
  stage: DescentZoneEnum,
  status: RunStatusEnum,
  currentQuestionIndex: z.number().int().min(0),
  playerHp: z.number().int().min(0).max(100),
  enemyHp: z.number().int().min(0).max(100),
  xp: z.number().int().min(0),
  shuffledBossOrder: z.array(z.string()).length(9),
  attempts: z.array(QuestionAttemptSchema),
  zoneScores: z.object({
    surface: z.number().int().min(0).max(3).default(0),
    twilight: z.number().int().min(0).max(3).default(0),
    midnight: z.number().int().min(0).max(3).default(0),
    boss: z.number().int().min(0).max(9).optional(),
  }),
  failureReason: z.string().optional(),
  completedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ExtractedPage = z.infer<typeof ExtractedPageSchema>;
export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;
export type PointNemoQuestion = z.infer<typeof PointNemoQuestionSchema>;
export type DescentZone = z.infer<typeof DescentZoneEnum>;
export type RunStatus = z.infer<typeof RunStatusEnum>;
export type QuestionAttempt = z.infer<typeof QuestionAttemptSchema>;
export type DescentRun = z.infer<typeof DescentRunSchema>;

export const SubjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  description: z.string().default(""),
});
export type Subject = z.infer<typeof SubjectSchema>;

export const ProgressSchema = z.object({
  id: z.string().uuid(),
  topicId: z.string().uuid(),
  status: z.enum(["not-started", "in-progress", "completed"]),
  completedLessons: z.number().int().min(0),
  updatedAt: z.string(),
});
export type Progress = z.infer<typeof ProgressSchema>;

export const StudyContentSchema = z.object({
  subject: SubjectSchema,
  topic: TopicSchema,
  content: z.string().trim().min(1),
});
export type StudyContent = z.infer<typeof StudyContentSchema>;

export const GeneratedQuestionSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).min(2),
  answerIndex: z.number().int().min(0),
  explanation: z.string().default(""),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const GeneratedQuestionsSchema = z.array(GeneratedQuestionSchema);
export const GeneratedQuestionResponseSchema = z.object({
  questions: GeneratedQuestionsSchema,
});
