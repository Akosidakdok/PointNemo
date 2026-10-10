import test from "node:test";
import assert from "node:assert/strict";
import { type DescentInstance, type LessonRecord } from "../src/game/lessonCatalog.ts";
import { answerPart, continuePart, answerBoss, continueBoss, resumeScreen, resolveGameplayScreen } from "../src/game/quizFlow.ts";

const questions = Array.from({ length: 9 }, (_, i) => ({
  prompt: `Question ${i + 1}`, options: ["A", "B", "C", "D"], correct: i % 4,
  answer: ["A", "B", "C", "D"][i % 4], explanation: `Explanation ${i + 1}`,
}));
const lesson: LessonRecord = {
  id: "saved-lesson", title: "Saved lesson", topics: ["", "One", "Two", "Three", "Lesson boss"],
  isCustom: true, questions: [null, ...questions],
  parts: [questions.slice(0, 3), questions.slice(3, 6), questions.slice(6, 9)],
};
function makeRun(): DescentInstance {
  return {
    id: "run-one", lessonId: lesson.id, routeNode: 1, state: "active",
    routePartAnswered: false, activeEncounter: true, bossReached: false,
    player: { x: 0.2, y: 0.22, facing: "left" }, playerHP: 100, enemyHP: 100,
    xp: 0, partCorrect: 0, questionIndex: 0, clearedParts: 0,
    bossOrder: [8, 0, 7, 1, 6, 2, 5, 3, 4], bossAnswers: [], bossQuestionIndex: 0, bossScore: 0,
  };
}

test("feedback, resume, and repeated clicks cannot score or skip another question", () => {
  let run = makeRun();
  assert.equal(continuePart(run, lesson, 1, 0), run);
  assert.equal(answerPart(run, lesson, 2, 0, 0), run);
  assert.equal(answerPart(run, { ...lesson, id: "other-lesson" }, 1, 0, 0), run);
  assert.equal(answerPart(run, lesson, 1, 0, 7), run);
  run = answerPart(run, lesson, 1, 0, 0);
  assert.equal(run.xp, 10);
  assert.equal(run.enemyHP, 50);
  assert.equal(answerPart(run, lesson, 1, 0, 1), run);
  assert.equal(resumeScreen(run), "encounter");
  assert.equal(resolveGameplayScreen("descent", run), "encounter");
  assert.equal(run.selectedOption, 0);
  run = continuePart(run, lesson, 1, 0);
  assert.equal(run.questionIndex, 1);
  assert.equal(continuePart(run, lesson, 1, 0), run);
  assert.equal(answerPart(run, lesson, 1, 0, 0), run);
  assert.equal(run.xp, 10);
});

test("all three topic questions are shown after enemy HP hits zero, then 2/3 passes", () => {
  let run = makeRun();
  for (let index = 0; index < 3; index++) {
    run = answerPart(run, lesson, 1, index, index < 2 ? questions[index].correct : (questions[index].correct + 1) % 4);
    assert.equal(run.state, "active");
    assert.equal(run.routeNode, 1);
    if (index === 1) assert.equal(run.enemyHP, 0);
    run = continuePart(run, lesson, 1, index);
  }
  assert.equal(run.routeNode, 2);
  assert.equal(run.clearedParts, 1);
  assert.equal(run.xp, 20);
  assert.equal(run.playerHP, 100);
  assert.equal(run.enemyHP, 100);
  assert.equal(run.activeEncounter, false);
  assert.deepEqual(run.player, makeRun().player);
  assert.equal(resumeScreen(run), "descent");
});

test("two early misses still allow question three before the topic fails", () => {
  let run = makeRun();
  for (let index = 0; index < 3; index++) {
    run = answerPart(run, lesson, 1, index, index === 2 ? questions[index].correct : (questions[index].correct + 1) % 4);
    assert.equal(run.state, "active");
    if (index >= 1) assert.equal(run.playerHP, 0);
    run = continuePart(run, lesson, 1, index);
  }
  assert.equal(run.state, "failed");
  assert.equal(run.routeNode, 1);
  assert.equal(run.xp, 10);
  assert.equal(resumeScreen(run), "results");
  assert.equal(resolveGameplayScreen("descent", run), "results");
});

test("three passed parts unlock the boss and preserve the original run and shuffled order", () => {
  let run = makeRun();
  for (let node = 1; node <= 3; node++) {
    run = { ...run, activeEncounter: true };
    for (let index = 0; index < 3; index++) {
      run = answerPart(run, lesson, node, index, lesson.parts![node - 1][index].correct);
      run = continuePart(run, lesson, node, index);
    }
  }
  assert.equal(run.routeNode, 4);
  assert.equal(run.clearedParts, 3);
  assert.equal(run.xp, 90);
  assert.equal(run.enemyHP, 80);
  assert.equal(run.bossReached, false);
  assert.deepEqual(run.bossOrder, makeRun().bossOrder);
  assert.equal(answerBoss(run, lesson, 0, 0), run);
  run = { ...run, bossReached: true, bossStarted: true };
  assert.equal(resumeScreen(run), "boss");
  assert.equal(resolveGameplayScreen("descent", run), "boss");
  assert.equal(resolveGameplayScreen("results", run), "boss");
});

for (const misses of [1, 2]) test(`boss presents all nine slots and ${9 - misses}/9 ${misses === 1 ? "passes" : "fails"}`, () => {
  let run: DescentInstance = { ...makeRun(), routeNode: 4, activeEncounter: false, bossReached: true, bossStarted: true, enemyHP: 80, xp: 90 };
  for (let index = 0; index < 9; index++) {
    const question = questions[run.bossOrder![index]];
    const option = index < misses ? (question.correct + 1) % 4 : question.correct;
    const before = run;
    run = answerBoss(run, lesson, index, option);
    assert.equal(before.bossAnswers!.length, index);
    assert.equal(run.bossAnswers!.length, index + 1);
    assert.equal(answerBoss(run, lesson, index, option), run);
    assert.equal(run.state, "active");
    if (misses === 2 && index >= 1) assert.equal(run.playerHP, 0);
    run = continueBoss(run, lesson, index);
    assert.equal(continueBoss(run, lesson, index), run);
    assert.equal(answerBoss(run, lesson, index, option), run);
  }
  assert.equal(run.state, misses === 1 ? "completed" : "failed");
  assert.equal(run.bossScore, 9 - misses);
  assert.equal(run.xp, 90 + (9 - misses) * 10);
  assert.deepEqual(run.bossOrder, makeRun().bossOrder);
});
