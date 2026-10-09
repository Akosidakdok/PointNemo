import { ApiRequestError, type AnswerFeedback, type CurrentSlot, type QuestionSet, type RunDetail } from "./api";

export interface FeedbackView {
  slotId: string;
  slotIndex: number;
  encounterType: CurrentSlot["encounterType"];
  question: CurrentSlot["question"];
  selectedOptionIndex: number;
  feedback: AnswerFeedback;
}

export function captureSlot(slot: CurrentSlot): CurrentSlot {
  return { ...slot, question: { ...slot.question, options: [...slot.question.options] } };
}

// Resume feedback uses the answered question's identity/options, never the next
// unanswered question that is now in currentSlot.
export function restoreLatestFeedback(run: RunDetail, questions: QuestionSet): FeedbackView | null {
  const latest = run.attempts?.reduce<(NonNullable<RunDetail["attempts"]>)[number] | undefined>(
    (previous, attempt) => !previous || attempt.slotIndex > previous.slotIndex ? attempt : previous, undefined,
  );
  if (!latest) return null;
  const question = questions.questions.find((entry) => entry.id === latest.questionId);
  if (!question || !latest.options || latest.options.length !== 4) {
    throw new ApiRequestError("The saved answer is missing its question or options. Refresh after checking the local server.", "INVALID_RESPONSE", 502);
  }
  return {
    slotId: latest.slotId, slotIndex: latest.slotIndex, encounterType: latest.encounterType,
    question: {
      id: question.id, topicId: question.topicId, topicName: latest.topicName,
      prompt: latest.questionPrompt, options: [...latest.options], difficulty: question.difficulty,
    },
    selectedOptionIndex: latest.selectedOptionIndex,
    feedback: run.latestFeedback ?? latest.feedback,
  };
}
