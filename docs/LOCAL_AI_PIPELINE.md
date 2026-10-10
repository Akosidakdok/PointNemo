# Local AI pipeline

## Implementation status

The implemented pipeline uses the installed `qwen2.5:3b` model by default, bounded prompts, exact source citations, targeted repairs, saved-lesson reuse, cancellation, and visible processing phases. TypeScript checks and the application build pass. The running development app reports a healthy API, database, tokenizer, and local 3B model.

The v16 comparison completed 4/4 synthetic cold/warm samples with 3B (22.2–31.9 seconds) versus 1/4 with 1.5B. This supports choosing 3B over 1.5B on this laptop; it does not establish general answer quality or a universal speed gain. Manual review still found ambiguous distractors and weak difficulty progression. Later versions add complete-question/choice-format checks, more explicit application prompts, context retention for references such as “its subnet mask,” and answer-overlap checks. Those stricter checks reject some previously accepted lessons. Their reports are separate; v16's completion rate must not be attributed to the final pipeline.

The committed baseline completed one of two cold samples (20.2 seconds); the other failed after 51.7 seconds. Earlier diagnostic reports remain under `artifacts/`, including the partial v9 comparison. Successful latency numbers from those drafts should not be treated as quality results.

Final v23 measurements on the RTX 3050 laptop (two synthetic PDFs, seed 42, cold/warm runs):

| Measurement | Result |
| --- | --- |
| Automated completion | 4/4 lessons |
| First pass without repair | 0/4; every lesson needed the bounded repair pass |
| Total latency median / observed maximum | 33.0 / 42.5 seconds |
| Cold / warm median | 38.8 / 30.5 seconds |
| Compatible saved-lesson reuse | 26–52 milliseconds; 4/4 reuse checks passed |

Report: `artifacts/local-ai-final-v23.json`. This is a small automated benchmark, not a validated general quality or fresh-generation speed improvement. Manual review still finds ambiguous choices and weak difficulty progression. The final 1.5B model was not rebenchmarked; its earlier v16 comparison is diagnostic evidence only.

## Processing

1. Extract normalized text locally and retain its original PDF hash. Raw PDFs are discarded after extraction.
2. Index exact source passages with stable IDs. Keep sentences beginning with references such as “its” or “each” with their preceding context when they fit the passage cap; omit dependent sentences when that context cannot fit. Each passage also includes up to two preceding sentences when the exact combined substring fits the 400-character cap. Mark its target sentence as FOCUS for planning and generation; surrounding sentences provide context. Sample across the document within the pinned tokenizer's input budget; large documents are sampled, not exhaustively summarized.
3. Plan three topics with three distinct objectives each. Generate one question per call using its assigned passage, concise answers, and explanation. This prevents a topic batch from pairing one question with another question's citation.
4. Resolve evidence IDs to exact page/chunk quotes in code. Place the correct answer among three distractors in code. Require the correct answer to be a short exact phrase in its cited passage (ignoring case and normalized whitespace). Check complete questions, separate unlabeled choices, shape, counts, distinct options, duplicate stems, source quotes, and a conservative lexical grounding screen. This deliberately limits answers to source phrases; a scenario can select a cited concept, but unsupported paraphrases or calculations are rejected.
5. Run one bounded repair pass. Option-only failures get at most two distractor candidates preserving the stem, correct answer and citation, followed by one complete question rewrite if both candidates fail. Full question repairs get at most two candidates. Each candidate is checked immediately for fields, answer support, choices and duplicates; passing questions are retained. Extra PDF passages provide distractor context, while the assigned citation remains the support for the correct answer. Duplicate-fact repairs may choose another unused fact from the same topic. Malformed initial slots are repaired individually without throwing away other drafted questions. Validate all nine before saving the complete lesson atomically.

Planning asks for recall, relationship, and application objectives. Automated checks do not prove answer correctness, unambiguous distractors, or difficulty. The benchmark exports full questions and evidence for review.

Manual review of v22 still found synonymous choices (for example, “returns a response” versus “sends a response”), awkward stems, and hard slots that only test recall. These remain unresolved quality limitations. The source-phrase requirement prevents unsupported answers from being saved, but does not prove that the quoted answer correctly answers the stem. Do not interpret automated completion as a fully reviewed lesson.

Version 29 keeps the planner's distinct source passages and constrains correct-answer decoding to verbatim phrases of one to six words (at most 100 characters) from the assigned focus fact. Candidate phrases exclude dangling function words, sentence crossings and common declarative clauses to favor concise concepts and values. The model chooses its source answer before writing the question. It repairs harmless answer labels and missing question marks on interrogative prompts. Shared wording alone no longer rejects choices with different numeric values, negation or different concepts, and word order is preserved when comparing choices. Exact duplicates, conservative wording and plural equivalences, pairwise answer containment and source phrase support are still checked. Duplicate checks compare the cited focus fact and normalized stems. These checks do not prove that every distractor is wrong; ambiguous choices and difficulty still need quality review. Version 29 has not received a new benchmark.

Extra model-based review is experimental and opt-in (`OLLAMA_REVIEW=1`). Small-model trials produced contradictory false rejections, so it is disabled by default. When enabled, its categorized feedback is collected alongside basic validation before repair, and all checks run again afterward.

## Saved lessons and retries

The intake checkbox explicitly permits reusing an exact PDF's compatible saved lesson. Compatibility includes source hash, extractor/prompt/schema/tokenizer versions, model digest, and generation settings. Uncheck it for a fresh lesson. Saved lessons remain playable without Ollama, including older lessons using the supported persisted schema. Changing model or prompt does not erase runs or progress.

After extraction succeeds, a failed generation can retry from saved text without reuploading the PDF. Cancellation aborts inference and prevents a late save. A job has at most two attempts under one overall deadline. Sonar reports actual phases, source coverage, elapsed time, drafted question count, and repair count.

Calibration errors now distinguish unsupported/unreadable/password-protected PDFs, insufficient text or source facts, model availability, busy jobs, timeouts, malformed output, duplicate facts and unsupported answers. The screen offers saved-text retry when appropriate and a separate choice of another PDF. A failed retry-start request preserves the saved source reference for another retry. Validation is never bypassed to turn a failed draft into a playable lesson.

## Configuration

Set values in `.env`, then restart the API:

| Setting | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Install with `ollama pull qwen2.5:3b`; optional 1.5B model is faster per token but less reliable in this comparison |
| `OLLAMA_KEEP_ALIVE` | `30m` | Retain loaded weights between requests; `0` unloads immediately |
| `OLLAMA_NUM_CTX` | `8192` | Context allocation, capped at 8192 |
| `OLLAMA_MAX_INPUT_TOKENS` | `4096` | Complete prompt budget |
| `OLLAMA_MAX_OUTPUT_TOKENS` | `3072` | Per-call output cap |
| `INFERENCE_TIMEOUT_MS` | `180000` | Deadline shared by calls within an attempt |
| `JOB_TIMEOUT_MS` | `360000` | Complete job deadline |
| `OLLAMA_SEED` | unset | Optional reproducible seed; otherwise sample a fresh seed per job |
| `OLLAMA_REVIEW` | `0` | Experimental model-based review; `1` enables it |

Input plus output budgets and a 1024-token reserve must fit the context. The app accepts loopback HTTP Ollama only. Model vocabulary and merges must match the bundled tokenizer. No cloud inference is introduced.

Planning is capped at 768 output tokens, individual questions/full repairs at 768, and distractor repairs at 256. Experimental review is capped at 2048. Each cap also respects the configured output maximum. Calls share the attempt deadline, and the whole job retains its overall deadline.

## Measurements

Jobs retain extraction/selection/generation/validation/total times, selected source coverage, seed, repair counts, and Ollama load, prompt evaluation, output evaluation, token counts, and tokens per second. Ollama durations retain their native nanosecond units; app stage durations use milliseconds.

Run the isolated synthetic benchmark:

```cmd
npm run benchmark:ai -- --output=artifacts/local-ai-benchmark.json
npm run benchmark:ai -- --baseline --models=qwen2.5:1.5b --output=artifacts/local-ai-baseline.json
npm run benchmark:ai -- --review --runs=1 --output=artifacts/local-ai-experimental-review.json
```

The default comparison uses two fixtures, cold/warm repetitions, and both installed model tags with seed 42. It creates a temporary SQLite database, exports full questions/drafts/runtime details, and checks saved-lesson reuse. It refuses to compete with an active interactive generation job. `--baseline` loads the committed HEAD generation adapter in memory without resetting the checkout. Both runs use the current PDF extractor, so this compares generation rather than historical PDF parsing. Do not run model comparisons concurrently on the same GPU.

Two fixtures provide a smoke benchmark, not a general quality estimate. Review answers, ambiguity, and difficulty before choosing a model; completion rate alone is insufficient.
