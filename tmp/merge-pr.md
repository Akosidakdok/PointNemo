## Changes

- Integrate latest main (e985d39), resolving ten frontend conflicts.
- Preserve PDF safety checks, light theme, responsive styling and staged navigation.
- Improve local AI planning, source-grounded questions, bounded repairs, generation progress and compatible saved-lesson reuse.
- Restore complete three-question topic progression, marker-gated final review and correct scoring. Retain quiz state across app-tab navigation.
- Fix negative animation deltas, development API origin handling and stale verification fixtures.

## Verification

- `npm test`: 97 passing tests (35 assets, 53 API, 9 web).
- `npm run test:smoke`: passed with a temporary database and mock model using facts from the PDF.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Browser: PDF signature/size gate; saved nine-question lesson; marker confirmation; next-question action and in-session resume; final review/results locks.
- No unmerged paths or conflict markers; local recovery snapshot preserved.

## Current limits

- Main frontend map progress is in memory. Refresh resets it; integration with the separate persisted API run engine remains pending.
- Local model output still needs quality review for ambiguous choices and difficulty. Previous benchmark measurements are documented with their prompt versions; this merge does not claim a new model benchmark.
- Browser upload cap is 5 MiB; backend parser supports larger inputs independently.
- Local scratch files, benchmark reports, browser artifacts and sample output PDFs are excluded from this PR.
