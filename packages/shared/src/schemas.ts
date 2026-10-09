import { z } from "zod";

export const SubjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  description: z.string().default(""),
});

export const TopicSchema = z.object({
  id: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string().trim().min(1),
  description: z.string().default(""),
});

export const StudyContentSchema = z.object({
  subject: SubjectSchema,
  topic: TopicSchema,
  content: z.string().trim().min(1),
});

export const ProgressSchema = z.object({
  id: z.string().uuid(),
  topicId: z.string().uuid(),
  status: z.enum(["not-started", "in-progress", "completed"]),
  completedLessons: z.number().int().min(0),
  updatedAt: z.iso.datetime(),
});

export const GeneratedQuestionSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).min(2),
  answerIndex: z.number().int().min(0),
  explanation: z.string().default(""),
}).refine((question) => question.answerIndex < question.options.length, {
  message: "answerIndex must refer to an available option",
  path: ["answerIndex"],
});

export const GeneratedQuestionsSchema = z.array(GeneratedQuestionSchema);
export const GeneratedQuestionResponseSchema = z.object({
  questions: GeneratedQuestionsSchema,
});

export type Subject = z.infer<typeof SubjectSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type StudyContent = z.infer<typeof StudyContentSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

// ============================================================================
// POINT NEMO HACKATHON MVP SCHEMAS
// ============================================================================

export const ExtractedPageSchema = z.object({
  pageNumber: z.number().int().min(1),
  text: z.string(),
});

export const ExtractedDocumentSchema = z.object({
  filename: z.string().min(1),
  fileSize: z.number().int().min(1),
  pageCount: z.number().int().min(1),
  totalCharacters: z.number().int().min(300),
  pages: z.array(ExtractedPageSchema).min(1),
  normalizedText: z.string().min(300),
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
});

export const QuestionSetSchema = z.object({
  id: z.string().min(1),
  documentName: z.string().min(1),
  topics: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  questions: z.array(PointNemoQuestionSchema).length(9),
  extractedPages: z.array(ExtractedPageSchema),
  createdAt: z.string(),
});

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
export type QuestionSet = z.infer<typeof QuestionSetSchema>;
export type DescentZone = z.infer<typeof DescentZoneEnum>;
export type RunStatus = z.infer<typeof RunStatusEnum>;
export type QuestionAttempt = z.infer<typeof QuestionAttemptSchema>;
export type DescentRun = z.infer<typeof DescentRunSchema>;
