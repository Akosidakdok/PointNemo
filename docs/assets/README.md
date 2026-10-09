# PointNemo assets

Local OpenAI image-generation tooling for PointNemo's maps, characters, villains, and draft animation sprite sheets. Select **GPT Image 2.5 Sunburst** or **GPT Image 2.5 Flare** explicitly. This is an asset-production tool; the game only needs the exported PNGs.

The implemented combat effects, their reproducible atlas build, and battle timing are documented in [VFX_PLAN.md](VFX_PLAN.md). Those three sheets were created with the built-in imagegen tool; the CLI instructions below remain available for future assets.

For an inventory of each generated effect, source prompt, provenance, runtime animation, and preview steps, see the [combat effect asset catalog](../../assets/effects/README.md).

Requires **Node.js 22.9 or newer**. There are no dependencies to install.

## Setup

Copy `.env.example` to `.env` and enter your OpenAI API key locally:

```powershell
Copy-Item .env.example .env
notepad .env
```

The `.env` file is ignored by Git. Do not put the key in prompts, generated assets, frontend code, or a PWA bundle. API billing and access to the selected model are required; a ChatGPT subscription is not a substitute for an API key. Your organization may need API verification.

Check each model without generating an image:

```powershell
npm run assets -- --check --model sunburst
npm run assets -- --check --model flare
```

This checks model visibility. A successful check does not guarantee generation quota or permission; the image endpoint is the final check.

## Generate assets

Sunburst character:

```powershell
npm run assets -- --model sunburst --preset character --prompt "Original island explorer wearing a teal jacket and orange backpack, front view, 16-color palette, 32x32 sprite aesthetic." --out assets/characters/explorer.png
```

Flare villain:

```powershell
npm run assets -- --model flare --preset villain --prompt "Original deep-sea pirate in dark blue armor, coral-red eyes, front view, matching the explorer's pixel scale." --out assets/villains/pirate.png
```

Map:

```powershell
npm run assets -- --model sunburst --preset map --size 1536x1024 --prompt "Tropical island with sandy beaches, jungle, a wooden dock, and paths connecting three clearings. Top-down view." --out assets/maps/island.png
```

Animation draft using an approved character as a reference:

```powershell
npm run assets -- --model sunburst --preset animation --reference assets/characters/explorer.png --prompt "The same explorer walking to the right. Eight poses forming a continuous walk cycle." --out assets/animations/explorer-walk.png
```

Repeat `--reference` to provide multiple character or style references. References are sent to OpenAI's image-edit endpoint; generation without references uses its image-generation endpoint. Only provide references you intend to upload.

Each request produces one PNG and an adjacent `.png.json` containing the selected model, composed prompt, dimensions, settings, and returned usage. Files are never overwritten: use a new filename for each iteration. Reference paths are reduced to filenames in metadata.

Generation consumes paid API usage. The tool never retries automatically or silently substitutes another model. A timeout can still result in a billed generation; check your dashboard before rerunning.

## Preview a request without spending

```powershell
npm run assets -- --model flare --preset character --quality low --prompt "An island explorer" --out assets/characters/explorer-draft.png --dry-run
```

Dry runs print the exact request without calling OpenAI, creating output files, or requiring a key. Use `--prompt-file path/to/description.txt` instead of `--prompt` for longer art directions. Run `npm run assets -- --help` for all options.

## Delivering to the PWA team

Keep approved PNGs under `assets/characters`, `assets/villains`, `assets/maps`, and `assets/animations`, or choose a different destination using `--out`. The JSON sidecars are production records; your team can copy just the PNGs into the PWA's public/static assets directory. Asset generation happens on your computer, so the PWA needs no OpenAI key or live image-generation endpoint.

Generated pixel-art styling is not a guarantee of exact pixel grids. The requested image sizes are 1024x1024, 1536x1024, or 1024x1536; a prompt mentioning 32x32 describes the desired sprite aesthetic, not the exported dimensions. Review and clean up pixel grids, palettes, transparency, and tile seams before delivery. Use nearest-neighbor scaling for pixel art.

The animation preset requests eight equal cells in a 4x2 sheet. Inspect the result and correct frame spacing, identity, foot alignment, and loop timing before slicing it in a sprite editor or game engine. It produces a still PNG, not video, a GIF, or an automatically validated animation. All sidecars start with `reviewRequired: true`.

## Validation

```powershell
npm test
```

Tests mock OpenAI responses. They verify both model routes, multipart reference uploads, PNG/metadata export, input validation, overwrite protection, cleanup, and error redaction without paid calls. Real model access and visual quality require your API credentials and an actual generation.

Official references: [image generation](https://developers.openai.com/api/docs/guides/image-generation), [generation API](https://developers.openai.com/api/reference/resources/images/methods/generate), [editing API](https://developers.openai.com/api/reference/resources/images/methods/edit).
