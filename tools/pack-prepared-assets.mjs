// Deterministic atlas packaging: crop generated cutouts and preserve their colors/alpha.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mergeVfxRuntime } from './merge-vfx.mjs';
const require = createRequire(import.meta.url);
const sharp = require(process.env.ASSET_SHARP_MODULE || 'sharp');
const directory = fileURLToPath(new URL('../assets/prepared/', import.meta.url));
const source = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
const runtimeDir = join(directory, 'runtime');
await mkdir(runtimeDir, { recursive: true });
const runtime = { ...source, atlases: {}, frames: {} };
const groups = new Map();
for (const [name, frame] of Object.entries(source.frames)) {
  const group = name.split('.')[0];
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push([name, frame]);
}
for (const [group, entries] of groups) {
  const padding = 4;
  const left = Math.ceil(Math.max(...entries.map(([, f]) => f.anchor.x))) + padding;
  const top = Math.ceil(Math.max(...entries.map(([, f]) => f.anchor.y))) + padding;
  const right = Math.ceil(Math.max(...entries.map(([, f]) => f.rect.width - f.anchor.x))) + padding;
  const bottom = Math.ceil(Math.max(...entries.map(([, f]) => f.rect.height - f.anchor.y))) + padding;
  const width = left + right;
  const height = top + bottom;
  const columns = Math.min(4, entries.length);
  const rows = Math.ceil(entries.length / columns);
  const composites = [];
  for (let index = 0; index < entries.length; index++) {
    const [name, frame] = entries[index];
    const r = frame.rect;
    let buffer = await sharp(join(directory, source.atlases[frame.atlas].image))
      .extract({ left: r.x, top: r.y, width: r.width, height: r.height })
      .ensureAlpha().png().toBuffer();
    if (frame.maskRuns) {
      // Only eel silhouettes overlap neighboring bounding rectangles. Exclude adjacent animals.
      const mask = Buffer.alloc(r.width * r.height * 4);
      for (const [y, x, length] of frame.maskRuns) {
        for (let dx = 0; dx < length; dx++) {
          const offset = (y * r.width + x + dx) * 4;
          mask.fill(255, offset, offset + 4);
        }
      }
      const pngMask = await sharp(mask, { raw: { width: r.width, height: r.height, channels: 4 } }).png().toBuffer();
      buffer = await sharp(buffer).composite([{ input: pngMask, blend: 'dest-in' }]).png().toBuffer();
    }
    const cellX = (index % columns) * width;
    const cellY = Math.floor(index / columns) * height;
    const offsetX = Math.round(left - frame.anchor.x);
    const offsetY = Math.round(top - frame.anchor.y);
    composites.push({ input: buffer, left: cellX + offsetX, top: cellY + offsetY });
    runtime.frames[name] = {
      atlas: group,
      rect: { x: cellX, y: cellY, width, height },
      anchor: { x: left, y: top },
      kind: frame.kind, suggestedSize: frame.suggestedSize,
      source: { atlas: frame.atlas, ...frame.rect },
    };
  }
  const atlasWidth = columns * width;
  const atlasHeight = rows * height;
  await sharp({ create: { width: atlasWidth, height: atlasHeight, channels: 4, background: '#00000000' } })
    .composite(composites).png().toFile(join(runtimeDir, `${group}.png`));
  runtime.atlases[group] = { image: `${group}.png`, width: atlasWidth, height: atlasHeight, cellWidth: width, cellHeight: height };
}
// Opaque background copied without re-encoding or changes.
await writeFile(join(runtimeDir, 'water.png'), await readFile(join(directory, 'water.png')));
runtime.atlases.water = { ...source.atlases.water, image: 'water.png' };
await writeFile(join(runtimeDir, 'manifest.json'), `${JSON.stringify(runtime, null, 2)}\n`);
console.log(`Packed ${Object.keys(runtime.frames).length} aligned frames into ${groups.size} transparent atlases.`);
await mergeVfxRuntime();
