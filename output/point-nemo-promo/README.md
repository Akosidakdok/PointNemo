# Point Nemo promotional film

60 seconds · 1920 × 1080 · 30 FPS · H.264 MP4 with voice-over, original music, and burned-in narration captions.

## Preview and render

From this folder:

```cmd
npm ci
npm run studio
npm run typecheck
npm run stills
npm run render
```

The editable composition is `src/Promo.tsx`. The entry point is `src/index.tsx`; rendering uses `render.mjs`. All video assets are local in `public/`. The original music can be regenerated with `python make_score.py` when NumPy is installed. Narration and captions can be regenerated with `make_voiceover.py` and `make_captions.py`; install `edge-tts`, `imageio-ffmpeg`, and NumPy in `python-deps` first. Narration generation uses Microsoft's online speech service; the final project plays the saved local WAV. No reference audio is included.

## Creative direction

The supplied 41.97-second reference recording was inspected at twelve points. Its floating interface panels, spring reveals, restrained rotations, and soft depth informed the motion. At the user's request, the final visual theme follows the **website**: `#061426` and `#0A2B49` ocean backgrounds, cyan/blue accents, `#EDF7FC` text, `#A7C0D3` secondary text, the actual `waves.svg`, fine steel-blue borders, and Pixelify display typography. Body text, source quotes, and captions use a clean sans serif for readability. Point Nemo's prepared pixel artwork remains the hero imagery. This cut uses the implemented web interface; it does not advertise a native mobile release.

The supplied mobile pitch Markdown was treated as context. The requested product showcase determines the narrative. Claims follow the current implementation and observed local services.

## Capture provenance and boundaries

- Library, safety gate, and Sonar captures came from the actual React app at `http://127.0.0.1:5180`, with offline guest entry. The marine biology PDF passed browser preflight. Fresh local generation was started with saved-question reuse unchecked and completed successfully.
- The observed local model was `qwen2.5:3b`, rather than the brief's older `qwen2.5:1.5b`. The current browser limit is 5 MiB and the API requires at least 300 readable non-whitespace characters. The film does not repeat obsolete fixed three-page or 8,000-character ceilings.
- Main-app navigation repeatedly reset the selected lesson and logged React's maximum-update-depth error. The film therefore captures gameplay in `capture.tsx`, an isolated page that imports the **actual unmodified gameplay components** and uses a compatible question set read from the local API. It does not fake questions, feedback, battle scores, or results. Every captured score was earned by real button interactions. These shots are explicitly marked `ACTUAL COMPONENT DEMO`.
- The component demo uses the same marine biology PDF and validated saved questions. The feedback and completed-result shots are separate takes. A final review was actually played to 9/9 after clearing the three topic parts. Gameplay is held in React memory; this cut makes no claim that the displayed run was persisted to SQLite.
- The source excerpt on the evidence card is verbatim from page 1 of the sample PDF, and is labeled as an excerpt. The full supporting quote is present in the captured feedback.
- Prepared explorer animation uses manifest rectangles, timing, and anchors. Original internal highlights and pixel edges are preserved. Goblin Shark remains labeled as prototype boss art.
- Sonar stage captions explain the implemented sequence; actual screenshots are edited for time. No invented percentage or service telemetry is added.
- No profile, network leaderboard, cloud sync, OCR, measured learning gains, or app-store availability is advertised.

The original application and backend were not edited for this video. Existing user changes were preserved.

## Timeline

| Time | Product story |
|---|---|
| 00:00–00:06 | PDF-to-ocean opening and product reveal |
| 00:06–00:13 | Real local library |
| 00:13–00:19 | PDF safety gate |
| 00:19–00:27 | Local Sonar processing |
| 00:27–00:34 | Sequential lesson map |
| 00:34–00:45 | Real question, correction, quote, and page |
| 00:45–00:53 | Same-question shuffled final review |
| 00:53–00:57 | Earned component result |
| 00:57–01:00 | Quiet brand resolution |

## Audio

`public/score.wav` is an original synthesized ambient score with restrained plucks and sonar tones authored in `make_score.py`. `public/voiceover.wav` contains a calm English male narration generated with Microsoft Guy Neural. The narrator is normalized to -17 LUFS per segment; music is kept beneath it. `voiceover-script.txt` is the readable script, `voiceover.json` records actual segment timing, and `point-nemo-promo.srt` provides the subtitle file. Caption timing follows the measured segment durations, with phrase boundaries estimated proportionally. The supplied reference soundtrack was not copied.

## Capture page

From the repository root:

```cmd
node node_modules\vite\bin\vite.js --config output\point-nemo-promo\capture.config.mjs
```

Open `http://127.0.0.1:5181/output/point-nemo-promo/capture.html`. The page directly imports the original frontend components. It is a production aid and does not alter app navigation.
