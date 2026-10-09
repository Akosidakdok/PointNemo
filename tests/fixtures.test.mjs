import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the parser from the workspace that declares it; no generator dependency.
const { PDFParse } = createRequire(new URL('../apps/api/package.json', import.meta.url))('pdf-parse');
const fixturesDirectory = fileURLToPath(new URL('../fixtures/', import.meta.url));
const generator = fileURLToPath(new URL('../scripts/generate-fixtures.js', import.meta.url));
const normalize = (text) => text.trim().replace(/\s+/g, ' ');
const fixtureSpecs = [
  { stem: 'networking-demo', topics: ['IP Addressing', 'DNS', 'HTTP'], sampleEligible: true },
  { stem: 'networking-unseen', topics: ['TCP vs UDP', 'Ports', 'Subnetting'], sampleEligible: false },
];

async function readExpected(stem) {
  return JSON.parse(await readFile(join(fixturesDirectory, `${stem}.expected.json`), 'utf8'));
}

for (const { stem, topics, sampleEligible } of fixtureSpecs) {
  test(`${stem}: exact SHA-256, three extracted source pages, facts, and admission limits`, async () => {
    const expected = await readExpected(stem);
    const pdf = await readFile(join(fixturesDirectory, `${stem}.pdf`));
    assert.equal(expected.filename, `${stem}.pdf`);
    assert.equal(expected.synthetic, true);
    assert.equal(expected.sampleEligible, sampleEligible);
    assert.equal(expected.hashAlgorithm, 'SHA-256');
    assert.match(expected.documentHash, /^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(pdf).digest('hex'), expected.documentHash);
    assert.equal(pdf.length, expected.fileSize);
    assert.ok(pdf.length <= 5 * 1024 * 1024);
    assert.match(pdf.toString('ascii'), /^%PDF-1\.4\n/);
    assert.doesNotMatch(pdf.toString('ascii'), /\/(?:CreationDate|ModDate|ID)\b/);
    assert.equal(expected.pageCount, 3);
    assert.equal(expected.sourceTextFile, `${stem}.txt`);
    assert.deepEqual(expected.expectedTopics.map((topic) => topic.name), topics);

    const source = await readFile(join(fixturesDirectory, expected.sourceTextFile), 'utf8');
    assert.deepEqual(source.split('\f').map(normalize), expected.pages.map((page) => page.text));

    const parser = new PDFParse({ data: Uint8Array.from(pdf) });
    let extracted;
    try {
      extracted = await parser.getText({ pageJoiner: '' });
    } finally {
      await parser.destroy();
    }
    assert.equal(extracted.total, 3);
    assert.equal(extracted.pages.length, 3);
    const pages = extracted.pages.map((page) => ({
      pageNumber: page.num,
      chunkId: `chunk-${page.num}`,
      text: normalize(page.text),
    }));
    assert.deepEqual(pages, expected.pages.map(({ pageNumber, chunkId, text }) => ({ pageNumber, chunkId, text })));
    const normalizedText = pages.map((page) => page.text).join(' ');
    assert.equal(normalize(extracted.text), normalizedText);
    assert.equal(normalizedText, expected.normalizedText);
    assert.equal(normalizedText.length, expected.totalCharacters);
    assert.ok(normalizedText.length <= 8000);
    assert.equal(normalizedText.replace(/\s/g, '').length, expected.nonWhitespaceCharacters);
    assert.ok(expected.nonWhitespaceCharacters >= 300);

    for (const [index, topic] of expected.expectedTopics.entries()) {
      const page = pages[index];
      assert.equal(expected.pages[index].topic, topics[index]);
      assert.equal(topic.pageNumber, index + 1);
      assert.equal(topic.chunkId, `chunk-${index + 1}`);
      assert.ok(page.text.startsWith(`Topic ${index + 1}: ${topics[index]} `));
      assert.ok(topic.facts.length >= 3);
      for (const fact of topic.facts) {
        assert.ok(fact.length >= 20 && fact.length <= 400, 'Facts must be usable evidence quotes.');
        assert.ok(page.text.includes(fact), `Page ${page.pageNumber} must contain: ${fact}`);
        assert.equal(pages.filter((candidate) => candidate.text.includes(fact)).length, 1, 'A fact belongs to one topic page.');
      }
    }
  });
}

test('unseen fixture has distinct topics/facts/hash and is excluded from sample answers', async () => {
  const demo = await readExpected('networking-demo');
  const unseen = await readExpected('networking-unseen');
  assert.notEqual(unseen.documentHash, demo.documentHash);
  assert.notEqual(unseen.normalizedText, demo.normalizedText);
  assert.equal(unseen.sampleEligible, false);
  assert.equal(Object.hasOwn(unseen, 'questions'), false);
  for (const [source, other] of [[demo, unseen], [unseen, demo]]) {
    for (const topic of source.expectedTopics) {
      assert.equal(other.expectedTopics.some((candidate) => candidate.name === topic.name), false);
      for (const fact of topic.facts) assert.equal(other.normalizedText.includes(fact), false);
    }
  }
});

test('native generator reproduces all checked-in artifacts byte for byte across runs and time zones', async (t) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'point-nemo-fixtures-'));
  t.after(async () => {
    // Validate the exact temporary target before recursive cleanup on Windows.
    assert.equal(dirname(resolve(temporaryRoot)), resolve(tmpdir()));
    assert.ok(basename(temporaryRoot).startsWith('point-nemo-fixtures-'));
    await rm(temporaryRoot, { recursive: true, force: true });
  });
  for (const [index, timezone] of ['UTC', 'Asia/Manila'].entries()) {
    const outputDirectory = join(temporaryRoot, `run-${index}`);
    const result = spawnSync(process.execPath, [generator, outputDirectory], {
      cwd: temporaryRoot,
      env: { ...process.env, TZ: timezone },
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    for (const { stem } of fixtureSpecs) {
      for (const extension of ['pdf', 'txt', 'expected.json']) {
        const filename = `${stem}.${extension}`;
        assert.deepEqual(await readFile(join(outputDirectory, filename)), await readFile(join(fixturesDirectory, filename)), `${filename}, ${timezone}`);
      }
    }
  }
});
