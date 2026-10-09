import { z } from "zod";

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
  elapsedTimeMs: z.number().int().min(0).optional(),
  createdAt: z.string().datetime(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;

// Evidence, Questions, Topics, QuestionSet
export const EvidenceSchema = z.object({
  pageNumber: z.number().int().min(1),
  chunkId: z.string(),
  quote: z.string().min(20).max(400),
});
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
  topicName: z.string().min(1),
  difficulty: QuestionDifficultySchema,
  prompt: z.string().min(1).max(300),
  options: z.array(z.string().min(1).max(160)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1).max(600),
  evidence: z.array(EvidenceSchema).min(1).max(2),
});

export const AIQuestionSetOutputSchema = z.object({
  topics: z.array(z.object({
    name: z.string().min(1)
  })).length(3),
  questions: z.array(AIQuestionOutputSchema).length(9),
});
export type AIQuestionSetOutput = z.infer<typeof AIQuestionSetOutputSchema>;

export const QuestionSetSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  topics: z.array(TopicSchema).length(3),
  questions: z.array(QuestionSchema).length(9),
  createdAt: z.string().datetime(),
});
export type QuestionSet = z.infer<typeof QuestionSetSchema>;

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
  slotIndex: z.number().int().min(0),
  encounterType: z.enum(["surface", "twilight", "midnight", "boss"]),
  selectedOptionIndex: z.number().int().min(0).max(3),
  isCorrect: z.boolean(),
  feedback: AnswerFeedbackSchema,
  questionPrompt: z.string(),
  topicName: z.string(),
  createdAt: z.string().datetime(),
});
export type RunAttemptDetail = z.infer<typeof RunAttemptDetailSchema>;

export const RunDetailSchema = z.object({
  id: z.string().uuid(),
  questionSetId: z.string().uuid(),
  state: RunStateSchema,
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
