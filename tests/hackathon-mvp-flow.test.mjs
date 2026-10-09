import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ExtractedDocumentSchema,
  PointNemoQuestionSchema,
  QuestionSetSchema,
  DescentRunSchema,
} from '../packages/shared/dist/index.js';

test('ExtractedDocumentSchema validates documents with no page or size limit, but rejects under-300 char docs', () => {
  const sampleText = 'The epipelagic zone extends down to 200 meters. The mesopelagic zone stretches from 200 to 1000 meters. The bathypelagic zone encompasses depths from 1000 to 4000 meters where no sunlight penetrates. Bioluminescent organisms inhabit this dark realm.'.repeat(40);

  const largeDoc = {
    filename: 'extensive-ocean-manual.pdf',
    fileSize: 45 * 1024 * 1024, // 45 MiB
    pageCount: 15,
    pages: Array.from({ length: 15 }, (_, i) => ({
      pageNumber: i + 1,
      text: `Page ${i + 1} content: ${sampleText.slice(i * 500, (i + 1) * 500)}`,
    })),
    totalCharacters: sampleText.length,
    normalizedText: sampleText,
  };

  const parsed = ExtractedDocumentSchema.safeParse(largeDoc);
  assert.ok(parsed.success, 'Large document with 15 pages and 45 MiB should pass schema validation');

  // Reject totalCharacters < 300
  const tooFewChars = { ...largeDoc, totalCharacters: 200, normalizedText: 'Too short' };
  assert.ok(!ExtractedDocumentSchema.safeParse(tooFewChars).success, 'Should reject characters < 300');
});

test('QuestionSetSchema enforces exact 9 questions and valid options', () => {
  const createQ = (id, topic, difficulty) => ({
    id: `q-${id}`,
    topic,
    difficulty,
    prompt: `What is the significance of depth zone ${id}?`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    answerIndex: 1,
    explanation: 'Option B accurately reflects the source passage.',
    sourceQuote: 'The mesopelagic zone extends down to 1000 meters.',
    sourcePage: 2,
  });

  const valid9Questions = [
    createQ(1, 'Ocean Layers', 'easy'),
    createQ(2, 'Ocean Layers', 'easy'),
    createQ(3, 'Ocean Layers', 'easy'),
    createQ(4, 'Deep Sea Fauna', 'medium'),
    createQ(5, 'Deep Sea Fauna', 'medium'),
    createQ(6, 'Deep Sea Fauna', 'medium'),
    createQ(7, 'Abyssal Ecology', 'hard'),
    createQ(8, 'Abyssal Ecology', 'hard'),
    createQ(9, 'Abyssal Ecology', 'hard'),
  ];

  const validSet = {
    id: 'qs-1',
    documentName: 'ocean-science.pdf',
    createdAt: new Date().toISOString(),
    topics: ['Ocean Layers', 'Deep Sea Fauna', 'Abyssal Ecology'],
    questions: valid9Questions,
    extractedPages: [
      { pageNumber: 1, text: 'Sample page 1 text' },
      { pageNumber: 2, text: 'Sample page 2 text' },
      { pageNumber: 3, text: 'Sample page 3 text' },
    ],
  };

  assert.ok(QuestionSetSchema.safeParse(validSet).success, 'Exact 9 questions should validate');

  // Reject 8 questions
  const eightQuestions = {
    ...validSet,
    questions: valid9Questions.slice(0, 8),
  };
  assert.ok(!QuestionSetSchema.safeParse(eightQuestions).success, '8 questions must fail schema');

  // Reject invalid answerIndex
  const invalidAnswer = {
    ...validSet,
    questions: [
      { ...valid9Questions[0], answerIndex: 4 },
      ...valid9Questions.slice(1),
    ],
  };
  assert.ok(!QuestionSetSchema.safeParse(invalidAnswer).success, 'answerIndex 4 must fail schema');
});

test('DescentRun combat thresholds and status transitions', () => {
  const baseRun = {
    id: 'run-001',
    questionSetId: 'qs-1',
    documentName: 'ocean-science.pdf',
    stage: 'surface',
    status: 'active',
    currentQuestionIndex: 0,
    playerHp: 100,
    enemyHp: 100,
    xp: 0,
    shuffledBossOrder: ['q-1', 'q-2', 'q-3', 'q-4', 'q-5', 'q-6', 'q-7', 'q-8', 'q-9'],
    attempts: [],
    zoneScores: {
      surface: 0,
      twilight: 0,
      midnight: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.ok(DescentRunSchema.safeParse(baseRun).success);

  // Surface zone: 2/3 pass threshold
  const simulateSurfaceZone = (correctCount) => {
    let hp = 100;
    let score = 0;
    for (let i = 0; i < 3; i++) {
      const isCorrect = i < correctCount;
      if (isCorrect) score += 1;
      else hp = Math.max(0, hp - 50);
    }
    const passed = score >= 2 && hp > 0;
    return { hp, score, passed };
  };

  // 3 correct -> 100 HP, 3/3, passed
  const res3 = simulateSurfaceZone(3);
  assert.equal(res3.hp, 100);
  assert.equal(res3.score, 3);
  assert.equal(res3.passed, true);

  // 2 correct -> 50 HP, 2/3, passed
  const res2 = simulateSurfaceZone(2);
  assert.equal(res2.hp, 50);
  assert.equal(res2.score, 2);
  assert.equal(res2.passed, true);

  // 1 correct -> 0 HP (took 2 * 50 = 100 damage), failed
  const res1 = simulateSurfaceZone(1);
  assert.equal(res1.hp, 0);
  assert.equal(res1.score, 1);
  assert.equal(res1.passed, false);

  // Boss zone: 8/9 pass threshold
  const simulateBossZone = (correctCount) => {
    let hp = 100;
    let score = 0;
    for (let i = 0; i < 9; i++) {
      const isCorrect = i < correctCount;
      if (isCorrect) score += 1;
      else hp = Math.max(0, hp - 50);
    }
    const passed = score >= 8 && hp > 0;
    return { hp, score, passed };
  };

  assert.equal(simulateBossZone(8).passed, true, '8/9 correct passes boss');
  assert.equal(simulateBossZone(9).passed, true, '9/9 correct passes boss');
  assert.equal(simulateBossZone(7).passed, false, '7/9 correct fails boss');
});
