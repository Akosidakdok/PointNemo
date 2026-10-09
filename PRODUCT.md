# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Learners who want to turn their study notes into an interactive quiz expedition.

## Product Purpose

Point Nemo turns uploaded study material into questions that learners answer through a retro underwater RPG. Success means the learner can prepare an expedition from their material, play through the resulting questions, and review the run.

## Positioning

The learning run is framed as an underwater expedition, with questions generated from the learner's own uploaded material.

## Operating Context

The web app is local-first. Learners can enter as a guest, upload a document, prepare a run, answer questions, and review results in the expedition interface.

## Capabilities and Constraints

- The auth screen supports login, sign-up, and offline guest entry.
- Explorer identity and remembered-login state are stored in browser local storage.
- Authentication currently uses a local simulated flow; no remote authentication service is connected.
- Preserve the existing application routes and post-auth explorer library flow.
- Do not imply real player levels, XP, achievements, or run statistics where none exist.
- Prepared explorer and navigation buoy sprites are available in the runtime asset bundle.

## Brand Commitments

- The product name is Point Nemo.
- The authentication screen should feel like the opening of a deep-sea retro RPG expedition.
- Preserve the existing Point Nemo color system and prepared pixel-art assets.
- Keep ordinary authentication concepts clear and recognizable.

## Evidence on Hand

- Prepared runtime sprites and manifest: `apps/web/public/assets/runtime/`.
- The app's current auth, local library, upload, quiz, and results flows are implemented in `apps/web/src/`.
- No customer testimonials, adoption metrics, achievement system, or player progression data are established.

## Product Principles

- Use the learner's own study material as the source for a run.
- Keep the local-first path usable, including guest entry.
- Make the expedition framing support learning rather than obscure it.
- Preserve clear authentication and accessible interaction.

## Accessibility & Inclusion

Support keyboard navigation, screen-reader-readable labels and errors, visible focus, reduced motion, and touch-sized controls.
