Objective: VoyBus v2. Real Antofagasta GTFS data, line status, favorites, profile, i18n, notifications and the "Letrero" redesign, then merge to main and deploy for user review.
Branch: rediseno-ui (from integracion/rf07-mapa d32b336). Delivery: integration branch, then merge to main after user review. Runners: `npm test`, `npm run typecheck`, `npm --prefix front run build:web`, `npm run test:e2e` (PLAYWRIGHT_CHANNEL=chrome).

## Specs

- S1: The full specification is `docs/designs/voybus-v2-design.md`. Sections 2 (decisions D1-D11, user quotes verbatim), 3 to 6 (data, schema, API, UI, motion, accessibility) and 9 (risks) are the requirements.
- S2 (user, verbatim): "mira primero termina todo y unelo y desplegamos y lo reviso".
- S3 (user, verbatim): "trata de ocupar solo el sol en alto o xhigh para programar y si no pueden hacer la tarea ahi recien delegas a astra".
- S4: approved dependencies: @expo-google-fonts/barlow, @expo-google-fonts/barlow-condensed, expo-font, expo-image-picker, expo-notifications. Any other new dependency needs user approval.

## Tasks

| ID | Specs | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| T0 | S4 | inline (leader): dependencies, design doc, base commit | in progress | |
| B | S1 §3-5, §9 | delegated: Codex gpt-6.1-sol xhigh, wave 1 (disjoint: backend/**) | pending | |
| F0 | S1 §6 | delegated: Codex gpt-6.1-sol xhigh, wave 1 (disjoint: front foundation) | pending | |
| S1-S3 | S1 §6.2 | delegated: Codex gpt-6.1-sol high, wave 2 | pending | |
| S4-S6 | S1 §6.2 | delegated: Codex gpt-6.1-sol high, wave 3 | pending | |
| I | S1, S2 | inline (leader): integration, e2e, accessibility audit, docs, security review, merge | pending | |

## Log

- L1 (2026-11-17, user verbatim): "se me ocurrio agregar una seccion de perfil donde salga la foto del pasajero [...]" (full text in design doc D5).
- L2 (2026-11-17, user verbatim): "el de gtfs".
- L3 (2026-11-17, user verbatim): see design doc D11.
- L4 (2026-11-17, user verbatim): "mira primero termina todo y unelo y desplegamos y lo reviso".
- L5: writer reason: parallelism. Units B and F0 have disjoint edit surfaces (backend vs front) and are joined by the API contracts in design doc §5. Waves 2 and 3 split screens by file.
