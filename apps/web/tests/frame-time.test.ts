import test from "node:test";
import assert from "node:assert/strict";
import { frameDeltaSeconds, SpriteAnimation, type AssetBundle } from "../src/game/sprites.ts";

test("sprite loops survive first frames, backwards timestamps, and long pauses", () => {
  const bundle = {
    manifest: { animations: { swim: { frames: ["swim.0", "swim.1"], fps: 10, loop: true } } },
  } as AssetBundle;
  const animation = new SpriteAnimation(bundle, "swim");
  let previous: number | null = null;
  for (const time of [8, 24, 40, 39, 55, 10_000]) {
    const dt = frameDeltaSeconds(time, previous);
    assert.ok(dt >= 0 && dt <= 0.1);
    animation.update(dt);
    previous = time;
  }
  assert.ok(Math.abs(animation.elapsed - 0.148) < 1e-12);
  assert.equal(animation.frameName, "swim.1");
});

test("a new or resumed loop starts without elapsed time", () => {
  assert.equal(frameDeltaSeconds(8, null), 0);
  assert.equal(frameDeltaSeconds(50_000, null), 0);
  assert.equal(frameDeltaSeconds(24, 8), 0.016);
  assert.equal(frameDeltaSeconds(7, 8), 0);
  assert.equal(frameDeltaSeconds(Number.NaN, 8), 0);
  assert.equal(frameDeltaSeconds(8, Number.POSITIVE_INFINITY), 0);
});
