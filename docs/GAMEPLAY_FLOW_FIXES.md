# Gameplay flow fixes

## Cause

The integrated React flow reused the playground's one-question encounter shortcut. Its lesson adapter copied only the first three of nine generated questions. Answering once therefore exposed “Clear this part,” regardless of correctness, and skipped the intended topic sequence.

## Updated flow

- Uploaded lessons retain all nine questions, grouped into three topics with Easy → Medium → Hard ordering.
- Each answer shows feedback and its source. “Next question” appears until the final question; only then is the part resolved against the 2/3 threshold.
- Passed parts return to the map and unlock the next marker. Failed parts open Results. HP reaching zero does not skip remaining questions.
- Passing Part 3 unlocks the boss marker; the player must reach it before opening the review.
- Boss review reuses all nine questions in one shuffled order retained with the current instance. Each answer is counted once; 8/9 is required for an uploaded lesson.
- Scores and XP come from accepted answers. Zero is preserved, and Results cannot be opened as a fabricated success.
- Changing app tabs retains the current encounter, selected answer, boss order, and progress during the current page session. Starting another lesson or retry creates an isolated instance.
- Sample expeditions are explicitly labeled as three-question previews; they have one question per part and a three-question boss review.

## Additional fixes

Saved lessons without a run are loaded from the existing document API. Lesson filenames and the active lesson title are displayed correctly. Answer controls prevent duplicate submissions, keyboard focus moves to the next question, and movement buttons work with keyboard activation and pointer cancellation. Boss and Results navigation are gated by actual progression.

## Review and limits

Browser review covered an uploaded lesson's three-question part, 2/3 pass boundary, continuation at zero enemy HP, feedback retention across tabs, a failed sample part with zero scores/XP, and a complete shuffled sample boss with 3/3 and 60 XP (no final-answer double count). TypeScript checks and the production build pass.

The encounter was reviewed at 360px phone, 768px tablet, and 1280px desktop widths. Mobile header controls now wrap instead of clipping. Browser error logs were empty during the final review. Screenshots are saved in `artifacts/gameplay-flow/`.

Changes are frontend-only. This integrated map flow still keeps run progression in React memory; refreshing or closing the page resets that progression. It is not yet wired to the API's SQLite run engine, whose existing stage grouping is by difficulty rather than topic. Saved question sets remain in SQLite. The standalone playground remains a sample preview. These fixes do not validate the factual quality of existing generated questions.
