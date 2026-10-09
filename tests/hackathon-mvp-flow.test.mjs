import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ExtractedDocumentSchema,
  PointNemoQuestionSchema,
  QuestionSetSchema,
  DescentRunSchema,
  SubmitAnswerRequestSchema,
} from '../packages/shared/dist/index.js';

// Compatibility contracts only. The backend suite tests actual combat transitions.
const readExpected = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.expected.json`, import.meta.url), 'utf8'));
const demo = readExpected('networking-demo');
const unseen = readExpected('networking-unseen');

function documentWithText(pageTexts, overrides = {}) {
  const pages = pageTexts.map((text, index) => ({ pageNumber: index + 1, text }));
  const normalizedText = pages.map((page) => page.text.trim().replace(/\s+/g, ' ')).join(' ');
  return {
    filename: 'synthetic-notes.pdf',
    fileSize: 1024,
    pageCount: pages.length,
    pages,
    totalCharacters: normalizedText.length,
    normalizedText,
    ...overrides,
  };
}

const validDocument = documentWithText(demo.pages.map((page) => page.text), {
  filename: demo.filename,
  fileSize: demo.fileSize,
});

test('ExtractedDocumentSchema accepts both supported three-page fixtures', () => {
  for (const fixture of [demo, unseen]) {
    const document = documentWithText(fixture.pages.map((page) => page.text), {
      filename: fixture.filename,
      fileSize: fixture.fileSize,
    });
    assert.equal(ExtractedDocumentSchema.safeParse(document).success, true, fixture.filename);
  }
});

test('ExtractedDocumentSchema accepts exact admission boundaries', () => {
  const maximum = documentWithText(['x'.repeat(2666), 'x'.repeat(2666), 'x'.repeat(2666)], {
    fileSize: 5 * 1024 * 1024,
  });
  assert.equal(maximum.normalizedText.length, 8000);
  assert.equal(maximum.pageCount, 3);
  assert.equal(ExtractedDocumentSchema.safeParse(maximum).success, true);
  assert.equal(ExtractedDocumentSchema.safeParse(documentWithText(['x'.repeat(300)])).success, true);
});

test('ExtractedDocumentSchema admits documents with no upper page, file size, or character limit', () => {
  assert.equal(ExtractedDocumentSchema.safeParse({
    ...validDocument, fileSize: 10 * 1024 * 1024,
  }).success, true);
  const tenPages = documentWithText(Array.from({ length: 10 }, () => 'x'.repeat(100)));
  assert.equal(ExtractedDocumentSchema.safeParse(tenPages).success, true);
  const longDoc = documentWithText(['x'.repeat(12000)]);
  assert.equal(ExtractedDocumentSchema.safeParse(longDoc).success, true);
});

test('ExtractedDocumentSchema rejects fewer than 300 non-whitespace characters', () => {
  const document = documentWithText(['x '.repeat(299)]);
  assert.ok(document.normalizedText.length > 300, 'Whitespace must not satisfy the minimum.');
  assert.equal(document.normalizedText.replace(/\s/g, '').length, 299);
  assert.equal(ExtractedDocumentSchema.safeParse(document).success, false);
  assert.equal(ExtractedDocumentSchema.safeParse(documentWithText(['x'.repeat(299)])).success, false);
});

const questions = demo.expectedTopics.flatMap((topic) => ['easy', 'medium', 'hard'].map((difficulty) => ({
  id: `q-${topic.pageNumber}-${difficulty}`,
  topic: topic.name,
  difficulty,
  prompt: `Which source fact concerns ${topic.name} (${difficulty})?`,
  options: [topic.facts[0], 'All source facts are about ocean depth.', 'The passage contains no networking facts.', 'The passage describes a cooking recipe.'],
  answerIndex: 0,
  explanation: topic.facts[0],
  sourceQuote: topic.facts[0],
  sourcePage: topic.pageNumber,
})));
const validSet = {
  id: 'synthetic-schema-set',
  documentName: demo.filename,
  createdAt: '2026-10-10T00:00:00.000Z',
  topics: demo.expectedTopics.map((topic) => topic.name),
  questions,
  extractedPages: demo.pages.map(({ pageNumber, text }) => ({ pageNumber, text })),
};

test('QuestionSetSchema accepts nine questions with three topics and a difficulty matrix', () => {
  assert.equal(new Set(questions.map((question) => `${question.topic}:${question.difficulty}`)).size, 9);
  assert.equal(QuestionSetSchema.safeParse(validSet).success, true);
});

test('QuestionSetSchema rejects incomplete or oversized question/topic arrays', () => {
  for (const count of [8, 10]) {
    const invalidQuestions = count === 8 ? questions.slice(0, 8) : [...questions, questions[0]];
    assert.equal(QuestionSetSchema.safeParse({ ...validSet, questions: invalidQuestions }).success, false, `${count} questions`);
  }
  for (const topics of [validSet.topics.slice(0, 2), [...validSet.topics, 'Fourth topic']]) {
    assert.equal(QuestionSetSchema.safeParse({ ...validSet, topics }).success, false, `${topics.length} topics`);
  }
});

test('Question schemas reject invalid answer indices, options, difficulty, and source pages', () => {
  const question = questions[0];
  const invalidQuestions = [
    ...[-1, 4, 1.5].map((answerIndex) => ({ ...question, answerIndex })),
    { ...question, options: question.options.slice(0, 3) },
    { ...question, options: [...question.options, 'Fifth option'] },
    { ...question, options: ['', ...question.options.slice(1)] },
    { ...question, difficulty: 'impossible' },
    { ...question, sourcePage: 0 },
  ];
  for (const invalid of invalidQuestions) {
    assert.equal(PointNemoQuestionSchema.safeParse(invalid).success, false);
    assert.equal(QuestionSetSchema.safeParse({ ...validSet, questions: [invalid, ...questions.slice(1)] }).success, false);
  }
});

const validRun = {
  id: 'synthetic-schema-run',
  questionSetId: validSet.id,
  documentName: demo.filename,
  stage: 'surface',
  status: 'active',
  currentQuestionIndex: 0,
  playerHp: 100,
  enemyHp: 100,
  xp: 0,
  shuffledBossOrder: questions.map((question) => question.id),
  attempts: [],
  zoneScores: { surface: 0, twilight: 0, midnight: 0 },
  createdAt: '2026-10-10T00:00:00.000Z',
  updatedAt: '2026-10-10T00:00:00.000Z',
};

test('DescentRunSchema validates snapshots and rejects invalid bounds', () => {
  assert.equal(DescentRunSchema.safeParse(validRun).success, true);
  for (const patch of [
    { playerHp: -1 }, { playerHp: 101 }, { enemyHp: -1 }, { enemyHp: 101 },
    { xp: -1 }, { currentQuestionIndex: -1 }, { status: 'unknown' }, { stage: 'unknown' },
    { shuffledBossOrder: validRun.shuffledBossOrder.slice(0, 8) },
    { shuffledBossOrder: [...validRun.shuffledBossOrder, 'extra-question'] },
    { zoneScores: { ...validRun.zoneScores, surface: 4 } },
    { zoneScores: { ...validRun.zoneScores, boss: 10 } },
  ]) {
    assert.equal(DescentRunSchema.safeParse({ ...validRun, ...patch }).success, false, JSON.stringify(patch));
  }
});

test('SubmitAnswerRequestSchema requires a slot UUID and an integer option index from zero to three', () => {
  const slotId = '00000000-0000-4000-8000-000000000001';
  for (const selectedOptionIndex of [0, 1, 2, 3]) {
    assert.equal(SubmitAnswerRequestSchema.safeParse({ slotId, selectedOptionIndex }).success, true);
  }
  for (const selectedOptionIndex of [-1, 4, 1.5, '1']) {
    assert.equal(SubmitAnswerRequestSchema.safeParse({ slotId, selectedOptionIndex }).success, false);
  }
  assert.equal(SubmitAnswerRequestSchema.safeParse({ slotId: 'missing-slot-uuid', selectedOptionIndex: 0 }).success, false);
});
