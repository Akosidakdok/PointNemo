import { parseArgs } from 'node:util';
import { access, mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MODELS = Object.freeze({
  sunburst: 'gpt-image-2.5-sunburst',
  flare: 'gpt-image-2.5-flare',
});

const PRESETS = Object.freeze({
  character: 'One original full-body game character, centered, readable silhouette, consistent proportions, no cropping.',
  villain: 'One original full-body game villain, centered, distinctive readable silhouette, consistent proportions, no cropping.',
  map: 'Top-down orthographic game environment, consistent terrain scale and lighting, no UI, labels, or characters.',
  animation: 'A draft sprite sheet containing exactly 8 frames in a 4-column, 2-row grid, read left to right then top to bottom. Equal-size cells with no gutters or borders. One complete animation loop. Preserve character identity, outfit, palette, scale, and foot baseline across every frame. Keep every pose inside its cell.',
});
const QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max', 'auto'];
const SIZES = ['1024x1024', '1536x1024', '1024x1536'];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function buildRequest(options) {
  const model = MODELS[options.model ?? 'sunburst'] ?? options.model;
  if (!Object.values(MODELS).includes(model)) throw new Error('Model must be sunburst or flare.');
  const preset = options.preset ?? 'character';
  if (!Object.hasOwn(PRESETS, preset)) throw new Error('Preset must be character, villain, map, or animation.');
  if (typeof options.prompt !== 'string' || !options.prompt.trim()) throw new Error('Provide --prompt or --prompt-file.');
  const quality = options.quality ?? 'high';
  if (!QUALITIES.includes(quality)) throw new Error(`Quality must be one of: ${QUALITIES.join(', ')}.`);
  const size = options.size ?? '1024x1024';
  if (!SIZES.includes(size)) throw new Error(`Size must be one of: ${SIZES.join(', ')}.`);
  const background = options.background ?? (preset === 'map' ? 'opaque' : 'transparent');
  if (!['transparent', 'opaque', 'auto'].includes(background)) throw new Error('Invalid background.');
  const prompt = [
    'Create original pixel art for a web game. Use crisp square pixel clusters, a limited color palette, and consistent pixel scale. No anti-aliasing, soft gradients, text, watermark, or UI.',
    PRESETS[preset],
    options.reference?.length ? 'Use the supplied reference images for visual identity and style; preserve their palette and character details unless the description requests a change.' : '',
    options.prompt.trim(),
  ].filter(Boolean).join('\n\n');
  if (prompt.length > 32000) throw new Error('The composed prompt exceeds 32000 characters.');
  return { model, prompt, quality, size, background, output_format: 'png', n: 1 };
}

async function ensureAbsent(path) {
  try { await access(path); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error(`Output already exists: ${path}. Choose a new filename.`);
}

async function prepareReferences(paths) {
  if (paths.length > 16) throw new Error('Use at most 16 reference images.');
  const types = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
  return Promise.all(paths.map(async (path) => {
    const type = types[extname(path).toLowerCase()];
    if (!type) throw new Error('References must be PNG, WebP, or JPEG files.');
    const info = await stat(path);
    if (!info.isFile() || info.size === 0 || info.size >= 50 * 1024 * 1024) throw new Error('Each reference must be a nonempty file smaller than 50 MB.');
    return { name: basename(path), blob: new Blob([await readFile(path)], { type }) };
  }));
}

async function callOpenAI(url, init, fetchImpl) {
  let response;
  try { response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(300000) }); }
  catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('OpenAI request timed out. Check your dashboard before retrying; generation may still have been billed.');
    throw new Error('Could not reach OpenAI. Check your connection. No automatic retry was made.');
  }
  if (!response.ok) {
    // Do not print raw upstream bodies: they can contain sensitive request details.
    const reasons = {
      400: 'OpenAI rejected the image request. Check the prompt and model settings.',
      401: 'OpenAI rejected the API key. Check OPENAI_API_KEY in .env.',
      403: 'Your API project cannot access this model. Check model access and organization verification.',
      404: 'The selected model or endpoint is unavailable to this API project.',
      429: 'OpenAI quota or rate limit reached. Check API billing and limits.',
    };
    throw new Error(reasons[response.status] ?? `OpenAI request failed (HTTP ${response.status}). No automatic retry was made.`);
  }
  try { return await response.json(); }
  catch { throw new Error('OpenAI returned an unreadable response.'); }
}

export async function generateAsset(options, { apiKey = process.env.OPENAI_API_KEY, fetchImpl = fetch } = {}) {
  const request = buildRequest(options);
  if (!options.out || extname(options.out).toLowerCase() !== '.png') throw new Error('Provide --out with a .png filename.');
  const output = resolve(options.out);
  const metadataPath = `${output}.json`;
  await ensureAbsent(output);
  await ensureAbsent(metadataPath);
  const references = await prepareReferences(options.reference ?? []);
  if (options['dry-run']) return { dryRun: true, endpoint: references.length ? 'images/edits' : 'images/generations', output, request, references: references.map((item) => item.name) };
  if (!apiKey?.trim()) throw new Error('Set OPENAI_API_KEY in a local .env file before generating. See .env.example.');

  // Reserve both outputs before a billable request. Never overwrite approved assets.
  await mkdir(dirname(output), { recursive: true });
  const imageFile = await open(output, 'wx');
  let metadataFile;
  let completed = false;
  try {
    metadataFile = await open(metadataPath, 'wx');
    const headers = { Authorization: `Bearer ${apiKey}` };
    let body;
    if (references.length) {
      body = new FormData();
      for (const [name, value] of Object.entries(request)) body.append(name, String(value));
      for (const image of references) body.append('image[]', image.blob, image.name);
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(request);
    }
    const result = await callOpenAI(`https://api.openai.com/v1/images/${references.length ? 'edits' : 'generations'}`, { method: 'POST', headers, body }, fetchImpl);
    const base64 = result.data?.[0]?.b64_json;
    if (typeof base64 !== 'string' || !base64.length) throw new Error('OpenAI returned no image data.');
    const png = Buffer.from(base64, 'base64');
    if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE) || png.toString('ascii', 12, 16) !== 'IHDR') throw new Error('OpenAI returned an invalid PNG image.');
    const metadata = {
      generatedAt: new Date().toISOString(),
      ...request,
      preset: options.preset ?? 'character',
      references: references.map((item) => item.name),
      width: png.readUInt32BE(16),
      height: png.readUInt32BE(20),
      usage: result.usage ?? null,
      reviewRequired: true,
    };
    await imageFile.writeFile(png);
    await metadataFile.writeFile(`${JSON.stringify(metadata, null, 2)}\n`);
    completed = true;
    return { output, metadataPath, model: request.model };
  } finally {
    await imageFile.close();
    await metadataFile?.close();
    if (!completed) {
      await unlink(output).catch(() => {});
      if (metadataFile) await unlink(metadataPath).catch(() => {});
    }
  }
}

const HELP = `PointNemo asset generator — Node.js 22.9+

npm run assets -- --model sunburst --preset character --prompt "Your character" --out assets/characters/hero.png

--model         sunburst (default) | flare, or the full model ID
--preset        character (default) | villain | map | animation
--prompt        Subject, colors, perspective, and action
--prompt-file   Read the description from a UTF-8 text file instead
--reference     PNG/WebP/JPEG style or character reference; repeat for multiple
--out           New .png destination (existing files are never overwritten)
--quality       low | medium | high (default) | xhigh | max | auto
--size          1024x1024 (default) | 1536x1024 | 1024x1536
--background    transparent (default, except maps) | opaque | auto
--dry-run       Print the composed request without an API key or API call
--check         Check access to the selected model without generating an image
--help          Show this help

Generation uses paid OpenAI API usage. No automatic retries or model fallback.
Animation produces a draft 4x2 sprite sheet, not video or a finished animation.
`;

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: {
    model: { type: 'string' }, preset: { type: 'string' }, prompt: { type: 'string' },
    'prompt-file': { type: 'string' }, reference: { type: 'string', multiple: true },
    out: { type: 'string' }, quality: { type: 'string' }, size: { type: 'string' },
    background: { type: 'string' }, 'dry-run': { type: 'boolean' },
    check: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help || args.length === 0) { console.log(HELP); return; }
  if (values.check && values['dry-run']) throw new Error('Use --check or --dry-run separately. No API request was made.');
  if (values.check) {
    const model = buildRequest({ model: values.model, prompt: 'Check model access' }).model;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) throw new Error('Set OPENAI_API_KEY in a local .env file first.');
    await callOpenAI(`https://api.openai.com/v1/models/${model}`, { headers: { Authorization: `Bearer ${apiKey}` } }, fetch);
    console.log(`Model is accessible: ${model}. No image was generated. Generation may still require billing or organization verification.`);
    return;
  }
  if (values.prompt && values['prompt-file']) throw new Error('Use --prompt or --prompt-file, not both.');
  if (values['prompt-file']) values.prompt = await readFile(values['prompt-file'], 'utf8');
  const result = await generateAsset(values);
  console.log(values['dry-run'] ? JSON.stringify(result, null, 2) : `Saved ${result.output}\nMetadata: ${result.metadataPath}\nModel: ${result.model}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(`Asset generation failed: ${error.message}`); process.exitCode = 1; });
}
