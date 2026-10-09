import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SpriteAnimation, drawFrame, speciesScale, drawWater } from '../src/assets/sprites.js';
const base = new URL('../assets/prepared/runtime/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8'));
const bundle = { manifest, images: {} };

test('all atlas dimensions and frame coordinates match shipped PNGs', async () => {
  assert.equal(Object.keys(manifest.frames).length, 89);
  assert.equal(Object.keys(manifest.animations).length, 25);
  for (const [name, atlas] of Object.entries(manifest.atlases)) {
    const png = await readFile(new URL(atlas.image, base));
    assert.equal(png.readUInt32BE(16), atlas.width, name);
    assert.equal(png.readUInt32BE(20), atlas.height, name);
  }
  for (const [name, frame] of Object.entries(manifest.frames)) {
    const atlas = manifest.atlases[frame.atlas];
    assert.ok(atlas, name);
    assert.ok(frame.rect.x >= 0 && frame.rect.y >= 0, name);
    assert.ok(frame.rect.x + frame.rect.width <= atlas.width, name);
    assert.ok(frame.rect.y + frame.rect.height <= atlas.height, name);
    assert.ok(frame.anchor.x >= 0 && frame.anchor.x < frame.rect.width, name);
    assert.ok(frame.anchor.y >= 0 && frame.anchor.y < frame.rect.height, name);
  }
  for (const animation of Object.values(manifest.animations)) {
    assert.ok(animation.fps > 0);
    for (const name of animation.frames) assert.ok(manifest.frames[name], name);
  }
  for (const name of Object.values(manifest.aliases)) assert.ok(manifest.frames[name], name);
});

test('frames within each species have identical anchor and canvas dimensions', () => {
  for (const atlas of Object.keys(manifest.atlases).filter(name => name !== 'water')) {
    const frames = Object.values(manifest.frames).filter(frame => frame.atlas === atlas);
    const first = frames[0];
    for (const frame of frames) {
      assert.deepEqual(frame.anchor, first.anchor, atlas);
      assert.equal(frame.rect.width, first.rect.width, atlas);
      assert.equal(frame.rect.height, first.rect.height, atlas);
    }
  }
});

test('swimming loops wrap, nonlooping attacks stop, and replay resets the clock', () => {
  const swimmer = new SpriteAnimation(bundle, 'explorer.swim.left');
  const sequence = manifest.animations[swimmer.name];
  swimmer.update(sequence.frames.length / sequence.fps);
  assert.equal(swimmer.frameName, sequence.frames[0]);
  assert.equal(swimmer.finished, false);
  const attack = new SpriteAnimation(bundle, 'gulper.expand');
  attack.update(10);
  assert.equal(attack.frameName, 'gulper.2.3');
  assert.equal(attack.finished, true);
  attack.play('gulper.expand', { restart: true });
  assert.equal(attack.frameName, 'gulper.2.0');
  assert.throws(() => attack.update(-1), /seconds/);
  assert.throws(() => attack.play('unknown'), /Unknown/);
});

test('one fixed species scale works for every pose and draw uses the common anchor', () => {
  const scale = speciesScale(bundle, 'explorer', 80);
  assert.ok(scale > 0);
  const calls = [];
  const ctx = { drawImage: (...args) => calls.push(args) };
  drawFrame(ctx, bundle, 'explorer.down.0', 100, 100, scale);
  drawFrame(ctx, bundle, 'explorer.down.3', 100, 100, scale);
  assert.deepEqual(calls[0].slice(5), calls[1].slice(5));
  assert.equal(ctx.imageSmoothingEnabled, false);
});

test('water mirrors alternating columns and rows, including negative camera coordinates', () => {
  const flips = [];
  const ctx = { save() {}, restore() {}, translate() {}, scale: (x, y) => flips.push([x, y]), drawImage() {} };
  drawWater(ctx, {}, 640, 640, 320);
  assert.deepEqual(flips, [[1, 1], [-1, 1], [1, -1], [-1, -1]]);
  flips.length = 0;
  drawWater(ctx, {}, 1, 1, 320, -1, -1);
  assert.deepEqual(flips, [[-1, -1]]);
});
