# PointNemo visual effects sprite plan

## Goal and starting point

Build a small, reusable set of transparent pixel-art effects for hits and abilities. Start with the existing turn-based encounter: the player's hit deals 7 damage, the enemy's hit deals 4, and the enemy response spans 520 ms after the player's hit. The battle scene still uses CSS shapes, while the prepared creature atlases and `SpriteAnimation` helper live outside the React app. Effect artwork must remain usable when those character sprites replace the placeholders.

The first deliverable is a visible, timed **sonar hit on the enemy** and **physical hit on the player**. Keep the expanding sonar ring procedural; generate a compact sprite for its contact burst.

## Phase 1 — Define the effect contract

Use the existing runtime manifest shape: atlas image, named frame rectangles, per-frame anchors, and animation `frames`/`fps`/`loop`. Effects use transparent PNGs, a stable center/contact anchor, and nonlooping animations. An effect instance needs a name, target position, start time, optional scale, and a layer (`behind-actors`, `on-actors`, or `above-actors`). The renderer removes it when `SpriteAnimation.finished` becomes true.

Plan each effect at a **48–80 CSS-pixel display size**. Generate an eight-frame draft, then keep only the useful frames and tune its final FPS in metadata. Effects must read at the size used in the battle scene, not only in the source PNG. Use the existing dark navy, cyan, muted mint, and restrained coral palette from the [frontend handoff](../../FRONTEND_DESIGN_HANDOFF.md). Avoid text, scenery, solid backgrounds, large full-screen flashes, and glow that erases hard pixel edges.

## Phase 2 — Generate the first three sheets

| Order | Effect and runtime name | Visual sequence | Trigger and placement |
| --- | --- | --- | --- |
| 1 | Sonar contact, `effects.sonar-hit` | Small cyan compression point → broken circular burst → sparse bubbles → fade | When the player's pulse reaches the enemy; centered on the enemy's hit point, above the actor |
| 2 | Hull strike, `effects.hull-hit` | Tight coral/white spark → a few angular fragments → dim afterglow | When the enemy attack resolves; centered on the player's hull, above the actor |
| 3 | Sonar cast, `effects.sonar-cast` | Brief cyan emitter flash → short outward wake → fade | When the player attack starts; centered on the submersible, behind the actor |

Make **one effect per source sheet** so frame identity and cleanup stay manageable. The first three sheets were generated with the built-in imagegen tool using existing atlases as style references. Their PNGs, JSON sidecars, and exact prompts are under `assets/effects/source/`. The built-in tool did not require an API key. Keep approved source versions; generation never overwrites an existing file.

Prompt constraints for every sheet: eight ordered stages in a 4 × 2 grid; one isolated effect per cell; fixed center/contact point and apparent pixel scale; transparent background; generous cell margins; no character, enemy, UI, lettering, grid, or border. Request anticipation, impact, breakup, and decay as distinct stages. The animation preset only requests this layout: the resulting image still needs visual review and manual correction.

## Phase 3 — Prepare and package

1. Inspect each source sheet on checkerboard, white, and ocean backgrounds. Reject clipped particles, merged cells, inconsistent color, drifting centers, opaque halos, and frames that change into a different effect.
2. Extract and clean individual frames. Keep the **edited transparent inputs in Git** so the bundle can be rebuilt; the current creature pipeline's ignored intermediate sheets are not a good pattern for new effects.
3. Give each effect a fixed cell canvas and one shared anchor. Preserve small particles within the cell, but do not let transparent padding change the apparent scale between frames.
4. Extend the prepared-asset builder/packer to emit effect atlases and animations into the same runtime manifest used by `src/assets/sprites.js`. Generate the runtime files from tracked inputs; do not hand-edit the generated manifest.
5. Add the effects to the existing asset preview with single-play and replay controls. Record the chosen display size, FPS, and any visual cleanup decisions next to the source art.

## Phase 4 — Connect effects to battle events

Mount a transparent canvas over `.battle-scene` and render effects with the existing `SpriteAnimation` and `drawFrame` helpers. Map actor hit points from the scene layout to canvas coordinates so resizing does not move a burst away from its target. Keep gameplay damage in `battleReducer`; the VFX layer only responds to battle events.

The reducer now has explicit start and hit actions for both sides. This lets each strike spawn its effect once and change health at contact. Pending timers are canceled on turn changes or unmount, and reset clears active effects. Use the same event points when real actor sprites replace the CSS placeholders.

For reduced motion, show one readable impact frame briefly and skip the expanding or flashing sequence. Keep health and battle messages as the accessible source of outcome; effects are decorative.

## Phase 5 — Expand after the first encounter works

Reuse the contract for a small library: generic enemy hit, shield/armor hit, heal, defeat dissolve, and creature-specific abilities. The existing barreleye sonar, gulper ripple, and goblin lunge trail can be reviewed as possible starting frames, but their current manifest entries are isolated art rather than complete hit animations. Add an effect only when a gameplay event and placement point are defined.

## Completion criteria for the first slice

- The two hit effects and sonar cast appear at the intended contact points and play once per action.
- Every frame has transparent edges, a stable pivot, and readable motion at actual battle size.
- The runtime bundle is reproducible from tracked source and edited frames.
- Reset, rapid interaction, scene resizing, and reduced-motion mode do not leave stale effects.
- Damage values and battle outcomes remain controlled by gameplay state.

## First-slice implementation

The three source sheets are packed into `assets/effects/prepared/effects.png`, then merged into `assets/prepared/runtime/effects.png` and its manifest. Run `npm run prepare:vfx` after changing a source PNG. This requires Python with Pillow. The source sheets and prepared atlas are included in these repo changes, so the VFX bundle can be rebuilt after they are committed.

The asset preview shows all three animations with replay controls. The React battle loads the effect atlas through `src/assets/sprites.js`, positions canvases over the existing scene, and uses `player/attack-start`, `player/attack-hit`, `enemy/attack-start`, and `enemy/attack-hit` to keep contact effects aligned with health changes. Vite serves the runtime bundle from `assets/prepared/runtime` during development and copies it into production builds.

Phase 5 effects remain event-driven additions for later encounters; the current battle has no heal, shield, or defeat-dissolve event to attach them to.
