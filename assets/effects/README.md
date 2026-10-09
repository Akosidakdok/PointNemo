# PointNemo combat effect assets

This catalog documents the first three combat effects generated for the turn-based encounter. The source sheets were created with the built-in imagegen tool on 2026-10-09, using existing PointNemo sprites as visual references. Each source has a JSON provenance sidecar and an exact prompt file beside it.

## Asset catalog

| Effect | Source sheet and prompt | Animation | Use in the battle |
| --- | --- | --- | --- |
| Sonar contact | [`sonar-hit.png`](source/sonar-hit.png) · [`prompt`](source/sonar-hit.prompt.txt) · [`record`](source/sonar-hit.png.json) | `effects.sonar-hit`, 8 frames at 16 FPS (0.5 s) | Cyan impact burst centered on the enemy when the pulse lands; draw above the enemy |
| Hull strike | [`hull-hit.png`](source/hull-hit.png) · [`prompt`](source/hull-hit.prompt.txt) · [`record`](source/hull-hit.png.json) | `effects.hull-hit`, 8 frames at 16 FPS (0.5 s) | Coral and pale spark burst centered on the player when the counterattack lands; draw above the player |
| Sonar cast | [`sonar-cast.png`](source/sonar-cast.png) · [`prompt`](source/sonar-cast.prompt.txt) · [`record`](source/sonar-cast.png.json) | `effects.sonar-cast`, 8 frames at 20 FPS (0.4 s) | Cyan emitter flash on the player as the attack starts; draw behind the player |

All source sheets are transparent PNGs, 1774 × 887 pixels, arranged as four columns by two rows. The animation frames are ordered left to right, then top to bottom. The generation records identify the reference atlases used for visual style.

## Prepared and runtime files

- `prepared/effects.png` is the 1024 × 384 prepared atlas. It has three rows of eight frames, each frame in a 128 × 128 cell.
- `prepared/manifest.json` contains 24 frame rectangles, shared center anchors at (64, 64), and the three nonlooping animation definitions.
- `../prepared/runtime/effects.png` and `../prepared/runtime/manifest.json` are the files loaded by the web app. The asset loader only loads the `effects` atlas for the battle overlay.

The builder clears near-invisible alpha speckles below alpha 24, resizes each 4 × 2 source cell to its 128 × 128 runtime cell with nearest-neighbor sampling, and centers it on the shared anchor. It does not independently scale each frame. Source sheets remain unchanged. Generation records retain `reviewRequired: true`; inspect any revised art at actual game size before treating it as final.

## Rebuild and preview

From the repository root, run:

```cmd
npm run prepare:vfx
npm run preview:assets
```

Open `http://127.0.0.1:8080` to review each animation and its frames. Use the replay control to play the nonlooping sequences again. The prepared atlas and runtime manifest are generated from the source sheets, so update those source files and their prompt/provenance records together when replacing an effect.

## Integration notes

The runtime animation names are consumed by `apps/web/src/components/BattleEffects.tsx`. Battle events trigger sonar cast at attack start, sonar hit at enemy contact, and hull hit at player contact. Damage and turn outcomes remain owned by the battle reducer. Reduced-motion mode shows one representative frame briefly instead of playing the full sequence.

The generated effects use abstract bursts and particles without character art. They are designed to stay readable over the existing ocean scene and can follow the same actor anchors when the CSS placeholder actors are replaced by sprites.
