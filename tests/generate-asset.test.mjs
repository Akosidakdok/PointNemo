import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRequest, generateAsset, main } from '../tools/generate-asset.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'pointnemo-assets-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return { folder, out: join(folder, 'hero.png') };
}
function imageResponse() { return Response.json({ data: [{ b64_json: PNG.toString('base64') }], usage: { total_tokens: 42 } }); }

test('a dry run cannot accidentally perform a model access request', async () => {
  await assert.rejects(main(['--check', '--dry-run']), /No API request was made/);
});

test('both selectors route to the exact requested model with PNG defaults', () => {
  for (const model of ['sunburst', 'flare']) {
    const request = buildRequest({ model, prompt: 'An explorer' });
    assert.equal(request.model, `gpt-image-2.5-${model}`);
    assert.equal(request.background, 'transparent');
    assert.equal(request.output_format, 'png');
  }
  assert.equal(buildRequest({ preset: 'map', prompt: 'An island' }).background, 'opaque');
  assert.match(buildRequest({ preset: 'animation', prompt: 'Walking' }).prompt, /4-column, 2-row/);
});

test('invalid inputs are rejected before any billable request', async (t) => {
  const { out } = await fixture(t);
  for (const invalid of [{ model: 'unknown' }, { preset: 'other' }, { prompt: '' }, { quality: 'ultra' }, { size: '32x32' }, { background: 'other' }, { out: 'bad.jpg' }, { prompt: 'x'.repeat(32000) }]) {
    await assert.rejects(generateAsset({ out, prompt: 'A hero', ...invalid }, {
      apiKey: 'fake', fetchImpl: () => assert.fail('Must not call OpenAI'),
    }));
  }
});

test('dry run needs no key and does not create files or call OpenAI', async (t) => {
  const { out, folder } = await fixture(t);
  const result = await generateAsset({ out, prompt: 'A hero', 'dry-run': true }, {
    apiKey: '', fetchImpl: () => assert.fail('Must not call OpenAI'),
  });
  assert.equal(result.dryRun, true);
  assert.deepEqual(await readdir(folder), []);
});

test('generation sends the selected model and saves PNG plus key-free metadata', async (t) => {
  const { out } = await fixture(t);
  const result = await generateAsset({ out, model: 'flare', prompt: 'A hero' }, {
    apiKey: 'test-secret', fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/images/generations');
      assert.equal(init.headers.Authorization, 'Bearer test-secret');
      assert.equal(JSON.parse(init.body).model, 'gpt-image-2.5-flare');
      return imageResponse();
    },
  });
  assert.deepEqual(await readFile(out), PNG);
  const rawMetadata = await readFile(result.metadataPath, 'utf8');
  assert.ok(!rawMetadata.includes('test-secret'));
  const metadata = JSON.parse(rawMetadata);
  assert.equal(metadata.width, 1);
  assert.equal(metadata.height, 1);
  assert.equal(metadata.usage.total_tokens, 42);
  assert.equal(metadata.reviewRequired, true);
});

test('references use multipart edits with correct image fields and no forced content type', async (t) => {
  const { out, folder } = await fixture(t);
  const reference = join(folder, 'reference.png');
  await writeFile(reference, PNG);
  await generateAsset({ out, prompt: 'Walking', preset: 'animation', reference: [reference] }, {
    apiKey: 'fake', fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/images/edits');
      assert.equal(init.headers['Content-Type'], undefined);
      assert.ok(init.body instanceof FormData);
      assert.equal(init.body.get('model'), 'gpt-image-2.5-sunburst');
      assert.equal(init.body.getAll('image[]').length, 1);
      assert.equal(init.body.get('image[]').name, 'reference.png');
      return imageResponse();
    },
  });
});

test('existing images and metadata are protected without API calls', async (t) => {
  const { out } = await fixture(t);
  await writeFile(`${out}.json`, 'approved metadata');
  await assert.rejects(generateAsset({ out, prompt: 'A hero' }, {
    apiKey: 'fake', fetchImpl: () => assert.fail('Must not call OpenAI'),
  }), /already exists/);
  assert.equal(await readFile(`${out}.json`, 'utf8'), 'approved metadata');
  await writeFile(out, PNG);
  await assert.rejects(generateAsset({ out, prompt: 'A hero' }), /already exists/);
  assert.deepEqual(await readFile(out), PNG);
});

test('missing key leaves no placeholders', async (t) => {
  const { out, folder } = await fixture(t);
  await assert.rejects(generateAsset({ out, prompt: 'A hero' }, { apiKey: '' }), /OPENAI_API_KEY/);
  assert.deepEqual(await readdir(folder), []);
});

test('API failures remove reserved files, redact upstream details, and never retry', async (t) => {
  const { out, folder } = await fixture(t);
  for (const status of [400, 401, 403, 404, 429, 500]) {
    let calls = 0;
    await assert.rejects(generateAsset({ out, prompt: 'A hero' }, {
      apiKey: 'test-secret', fetchImpl: async () => {
        calls++;
        return Response.json({ error: { message: 'Sensitive data test-secret' } }, { status });
      },
    }), (error) => !error.message.includes('Sensitive') && !error.message.includes('test-secret'));
    assert.equal(calls, 1);
    assert.deepEqual(await readdir(folder), []);
  }
});

test('network failures, timeouts, unreadable responses, and invalid images clean up outputs', async (t) => {
  const { out, folder } = await fixture(t);
  for (const fetchImpl of [
    async () => { throw new Error('Network failure with secret'); },
    async () => { throw new DOMException('Timed out', 'TimeoutError'); },
    async () => new Response('bad JSON'),
    async () => Response.json({ data: [] }),
    async () => Response.json({ data: [{ b64_json: Buffer.from('not an image').toString('base64') }] }),
  ]) {
    await assert.rejects(generateAsset({ out, prompt: 'A hero' }, { apiKey: 'fake', fetchImpl }));
    assert.deepEqual(await readdir(folder), []);
  }
});
