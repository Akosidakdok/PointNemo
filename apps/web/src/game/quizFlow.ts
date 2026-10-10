import { type DescentInstance, type LessonRecord, lessonParts, bossPassScore } from "./lessonCatalog";

export type GameplaySubscreen = "seas" | "descent" | "encounter" | "boss" | "results";

export function resumeScreen(instance: DescentInstance): GameplaySubscreen {
  if (instance.state !== "active") return "results";
  if (instance.bossReached) return "boss";
  return instance.activeEncounter ? "encounter" : "descent";
}

export function resolveGameplayScreen(requested: GameplaySubscreen, instance: DescentInstance): GameplaySubscreen {
  if (requested === "seas") return requested;
  if (instance.state !== "active") return "results";
  if (requested === "results" || requested === "boss" && !instance.bossReached) return resumeScreen(instance);
  if (requested === "descent" || requested === "encounter") {
    if (instance.bossStarted) return "boss";
    return instance.activeEncounter ? "encounter" : "descent";
  }
  return requested;
}

// Each action carries the slot displayed when it was clicked. Late/repeated actions
// cannot score the following question or advance a different topic.
export function answerPart(instance: DescentInstance, lesson: LessonRecord, node: number, index: number, option: number): DescentInstance {
  const question = lessonParts(lesson)[node - 1]?.[index];
  if (instance.lessonId !== lesson.id || instance.state !== "active" || !instance.activeEncounter || instance.routeNode !== node ||
      (instance.questionIndex ?? 0) !== index || instance.routePartAnswered || !question ||
      !Number.isInteger(option) || option < 0 || option >= question.options.length) return instance;
  const correct = option === question.correct;
  return {
    ...instance,
    routePartAnswered: true,
    selectedOption: option,
    partCorrect: (instance.partCorrect ?? 0) + Number(correct),
    xp: (instance.xp ?? 0) + (correct ? 10 : 0),
    enemyHP: correct ? Math.max(0, instance.enemyHP - 50) : instance.enemyHP,
    playerHP: correct ? instance.playerHP : Math.max(0, instance.playerHP - 50),
  };
}

export function continuePart(instance: DescentInstance, lesson: LessonRecord, node: number, index: number): DescentInstance {
  const questions = lessonParts(lesson)[node - 1];
  if (instance.lessonId !== lesson.id || instance.state !== "active" || !instance.activeEncounter || !instance.routePartAnswered ||
      instance.routeNode !== node || (instance.questionIndex ?? 0) !== index || !questions?.[index]) return instance;
  if (index < questions.length - 1) return {
    ...instance, questionIndex: index + 1, routePartAnswered: false, selectedOption: null,
  };
  if ((instance.partCorrect ?? 0) < Math.ceil(questions.length * 2 / 3)) return {
    ...instance, state: "failed", activeEncounter: false,
  };
  return {
    ...instance,
    routeNode: node + 1,
    activeEncounter: false,
    routePartAnswered: false,
    selectedOption: null,
    questionIndex: 0,
    partCorrect: 0,
    clearedParts: (instance.clearedParts ?? 0) + 1,
    playerHP: 100,
    enemyHP: node === 3 ? 80 : 100,
  };
}

export function answerBoss(instance: DescentInstance, lesson: LessonRecord, index: number, option: number): DescentInstance {
  const answers = instance.bossAnswers ?? [];
  const question = lessonParts(lesson).flat()[instance.bossOrder?.[index] ?? index];
  if (instance.lessonId !== lesson.id || instance.state !== "active" || !instance.bossReached || !instance.bossStarted ||
      (instance.bossQuestionIndex ?? 0) !== index || answers.length !== index || !question ||
      !Number.isInteger(option) || option < 0 || option >= question.options.length) return instance;
  const correct = option === question.correct;
  return {
    ...instance,
    bossAnswers: [...answers, option],
    bossScore: (instance.bossScore ?? 0) + Number(correct),
    xp: (instance.xp ?? 0) + (correct ? 10 : 0),
    playerHP: correct ? instance.playerHP : Math.max(0, instance.playerHP - 50),
    enemyHP: correct ? Math.max(0, instance.enemyHP - 10) : instance.enemyHP,
  };
}

export function continueBoss(instance: DescentInstance, lesson: LessonRecord, index: number): DescentInstance {
  const total = lessonParts(lesson).flat().length;
  if (instance.lessonId !== lesson.id || instance.state !== "active" || !instance.bossReached || !instance.bossStarted || (instance.bossQuestionIndex ?? 0) !== index ||
      (instance.bossAnswers?.length ?? 0) !== index + 1 || index >= total) return instance;
  if (index < total - 1) return { ...instance, bossQuestionIndex: index + 1 };
  return { ...instance, state: (instance.bossScore ?? 0) >= bossPassScore(total) ? "completed" : "failed" };
}
