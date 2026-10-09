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

export const MvpTopicDraftSchema = z.object({
  key: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(100),
});

export const MvpQuestionDraftSchema = z.object({
  topicKey: z.string().trim().min(1).max(60),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question: z.string().trim().min(1).max(300),
  options: z.tuple([
    z.string().trim().min(1).max(160),
    z.string().trim().min(1).max(160),
    z.string().trim().min(1).max(160),
    z.string().trim().min(1).max(160),
  ]),
  correctOptionIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(1).max(600),
  evidence: z.object({
    page: z.number().int().min(1).max(3),
    quote: z.string().trim().min(20).max(400),
  }),
});

export const MvpQuestionSetDraftSchema = z.object({
  topics: z.tuple([MvpTopicDraftSchema, MvpTopicDraftSchema, MvpTopicDraftSchema]),
  questions: z.tuple([
    MvpQuestionDraftSchema,
    MvpQuestionDraftSchema,
    MvpQuestionDraftSchema,
    MvpQuestionDraftSchema,
    MvpQuestionDraftSchema,
    MvpQuestionDraftSchema,
    MvpQuestionDraftSchema,
    MvpQuestionDraftSchema,
    MvpQuestionDraftSchema,
  ]),
});

export const CreateRunRequestSchema = z.object({
  questionSetId: z.string().uuid(),
});

export const SubmitAnswerRequestSchema = z.object({
  slotId: z.string().uuid(),
  selectedOptionIndex: z.number().int().min(0).max(3),
});

export type Subject = z.infer<typeof SubjectSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type StudyContent = z.infer<typeof StudyContentSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;
export type MvpQuestionSetDraft = z.infer<typeof MvpQuestionSetDraftSchema>;
export type MvpQuestionDraft = z.infer<typeof MvpQuestionDraftSchema>;
export type MvpTopicDraft = z.infer<typeof MvpTopicDraftSchema>;
