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
