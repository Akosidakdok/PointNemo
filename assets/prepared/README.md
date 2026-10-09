# Prepared PointNemo game assets

**Use the files inside `runtime/` in the web app.** They contain eight transparent, aligned sprite atlases, one opaque water background, and a single JSON manifest. Original white-background artwork remains untouched in `assets/characters`, `assets/enemies`, and `assets/maps`.

## What is included

| Atlas | Contents |
| --- | --- |
| `runtime/explorer.png` | 16 frames: idle plus swimming down, left, right, and up |
| `runtime/blobfish.png` | 8 frames: overhead, left, and right swimming |
| `runtime/barreleye.png` | 16 frames: idle views, swimming, eye focus, glowing sand, sonar |
| `runtime/gulper.png` | 16 frames: idle views, swimming, mouth expansion, ripples, depth indicators |
| `runtime/goblin.png` | 16 frames: idle views, overhead swimming, jaw lunge, substrate, motion trail |
| `runtime/fringehead.png` | 16 frames: burrow/profile idle, swimming, mouth flare, pattern variants, empty burrows |
| `runtime/buoy.png` | 1 independent red buoy with localized signal glow |
| `runtime/effects.png` | 24 frames for sonar cast, sonar hit, and hull hit |
| `runtime/water.png` | Water-only background, with the original buoy removed |
| `runtime/manifest.json` | 113 named frame rectangles, shared anchors, 28 animations, 16 environment aliases |

White-background extraction and water/buoy separation used the built-in image tool. Cropping and atlas packing then preserved the edited sprites' colors and alpha. Those edits are not guaranteed pixel-identical to the original sheets. The packing script isolates overlapping Gulper Eel silhouettes so their bounding rectangles do not include neighboring animals.

## Preview

From the repo root:

```sh
npm run preview:assets
```

Open **http://127.0.0.1:8080**. The preview includes all directional player loops, enemy swimming and ability sequences, three combat effects, environmental elements, checkerboard/white/ocean backgrounds, shared anchor markers, pause, and replay. Nonlooping animations play once and hold their final frame; click Replay abilities and effects to review them again. Reduced-motion users start paused.

## Integrate

Copy `runtime/` into a public/static asset folder in the frontend. Copy or import `src/assets/sprites.js` into your frontend source; adjust imports to the chosen framework. No image-generation API or API key is needed at runtime.

```js
import { loadAssetBundle, SpriteAnimation, speciesScale, drawWater, drawFrame } from './sprites.js';

const assets = await loadAssetBundle('/assets/runtime/manifest.json');
const explorer = new SpriteAnimation(assets, 'explorer.swim.down');
const explorerScale = speciesScale(assets, 'explorer', 80);
let previous = performance.now();

function render(now) {
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  explorer.update(dt);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWater(ctx, assets.images.water, canvas.width, canvas.height, 320);
  drawFrame(ctx, assets, 'buoy', 300, 160, speciesScale(assets, 'buoy', 100));
  explorer.draw(ctx, player.x, player.y, explorerScale);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// Change direction/state without resetting the clock every tick:
explorer.play('explorer.swim.left');
// Stop on an idle pose:
explorer.play('explorer.idle.left');
// Restart a single-play ability at the exact gameplay trigger:
const eel = new SpriteAnimation(assets, 'gulper.expand');
eel.play('gulper.expand', { restart: true });
```

`x/y` refers to the shared anchor, not the sprite's top-left corner. Each species has a fixed canvas and anchor in the packed atlas. Keep the SAME scale across every animation of that species so expanded jaws/frills grow naturally. Canvas smoothing is disabled by the drawing helper. Source frames are not constrained to one perfect low-resolution pixel grid; resizing these generated images can still alter apparent pixel clusters.

For your existing engine, use `frame.rect` as the source rectangle, `frame.anchor` as the pivot in frame-local pixels, and `animation.frames`/`fps`/`loop` as the animation sequence. The manifest also retains each source crop as provenance. Creature PNGs can be used with any engine supporting explicit atlas rectangles; the layout is now uniform within each species atlas.

## Important gameplay decisions

- Water uses **mirrored repeat**, not ordinary repeating UVs. Alternating horizontal/vertical flips join matching edge pixels and prevent repeated buoys. Mirroring produces visible symmetry in some wave patterns; the generated water is not certified seamless under normal repeat. Match `drawWater` or the manifest's `world.repeatMode` in another renderer.
- Environmental substrate squares and burrow art are static decorations; seamless terrain adjacency has not been established. Transparent padding should not be included when placing square terrain art flush.
- These are prepared **prototype animations**, not a complete combat system. Tune speeds and contact/recovery timing in the game. `gulper.expand`, `goblin.lunge`, `fringehead.flare`, and `barreleye.focus` are nonlooping. Use `finished` to transition to an idle, swim, or recovery animation.
- The original sets mix profile, overhead, and frontal views. `goblin.swim` and `blobfish.swim.down` are overhead; the other enemy swim/ability sequences follow their source views. Do not rotate those profile frames into missing overhead directions. Additional direction artwork is still needed for a fully top-down enemy roster.
- Some generated poses vary in anatomy/body proportions. Stable pivots reduce positional jitter but cannot turn them into hand-authored seamless cycles. The preview lets the team review that visual behavior.
- Collision hitboxes must follow gameplay rules, not the transparent canvas dimensions. No combat colliders or damage timing are inferred from the art.

## Validation and rebuilding

The bundle was loaded in a browser at desktop and mobile sizes, with no page errors or horizontal mobile overflow. The JSON, PNG dimensions, frame rectangles, shared anchors, animation timing, and mirrored water rendering have automated checks:

```sh
node --test tests/prepared-assets.test.mjs
```

Intermediate transparent edited sheets are local in this directory; `runtime/` is the deliverable. To regenerate metadata/packing after deliberately changing the edited sheets:

```sh
python tools/build-asset-manifest.py
node tools/pack-prepared-assets.mjs
```

The first command needs Pillow. The second needs the `sharp` Node module, or an `ASSET_SHARP_MODULE` environment variable pointing at an existing Sharp installation. Neither is a browser/runtime dependency. The builder's measured crop separators and pivots refer to these exact intermediate sheets; recheck them if a new image edit changes the layout.

See `preparation-prompts.txt` for the background extraction and ocean separation prompts.

## Combat effects

The VFX source PNGs, prompts, and sidecars are in `assets/effects/source/`; the prepared atlas and manifest are in `assets/effects/prepared/`. Include both directories in the commit. Rebuild and merge them with `npm run prepare:vfx` (Python and Pillow required). The web app loads only the `effects` atlas from the runtime manifest. See [the VFX plan](../../docs/assets/VFX_PLAN.md) for animation timing and event placement.
