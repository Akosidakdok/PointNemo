# Utility media assets

This folder holds media assets that support the game UI but are not character sprites, atlases, or frame-based combat effects.

## Catalog

| Asset | Type | Size | Intended use | Status |
| --- | --- | ---: | --- | --- |
| [`gameover-clip.mp4`](gameover-clip.mp4) | MP4 video | 2,029,082 bytes (about 1.93 MiB) | Optional visual treatment for a failed-run / game-over result | Catalogued; content and playback metadata need review before integration |

### `gameover-clip.mp4`

- Keep the supplied file at this path; it is a video clip, not a sprite sheet or an animation atlas input.
- Proposed UI placement: the Results screen when a run fails. The failure score, mistakes, supporting PDF quotes, and retry action must remain visible and usable independently of the clip.
- Review the clip's visual content, duration, dimensions, frame rate, audio track, and license/provenance before wiring it into the app. Those details have not been verified in this environment.
- If integrated, use a static fallback/poster, avoid sound autoplay, and respect reduced-motion preferences. Playback must not block results or retry.

The filename suggests a game-over treatment, but the clip has not been visually reviewed. Do not describe its scene or imply that it is integrated until that review and implementation are complete.
