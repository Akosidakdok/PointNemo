# Synthetic networking fixtures

Regenerate both PDFs and their source/expectation files with `node scripts/generate-fixtures.js`. The generator uses only Node built-ins and writes deterministic ASCII PDFs without dates, random IDs, compression, or dependency-specific metadata. An optional output-directory argument supports isolated integrity checks. The local `.gitattributes` preserves PDF bytes and uses LF for generated text and JSON so checkout line-ending conversion cannot invalidate the hashes.

- `networking-demo.pdf`: IP Addressing, DNS, and HTTP, one topic per page. This is eligible as source material for an explicitly labeled sample lesson.
- `networking-unseen.pdf`: TCP vs UDP, Ports, and Subnetting, one topic per page, with different facts and examples. Reserve it for fresh-generation/isolation acceptance. Never bundle it as a sample question set, pre-generate its answers, or seed a saved-set cache with it.

Each `.txt` contains the synthetic source with a form-feed character between pages. Each `.expected.json` records the PDF's exact SHA-256, byte size, normalized source, character counts, topic facts, and evidence references using `chunk-1`, `chunk-2`, and `chunk-3`. Normalize text by trimming and replacing whitespace runs with a single space; join normalized pages with one space. Counts exclude parser-added page markers.

These artifacts and automated checks do not establish real model correctness, a complete game run, offline operation, or runtime performance. Those require the acceptance evidence in the masterplan.
