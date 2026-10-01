# Sprint 4 Smoke Tests

Sprint 4 makes the app usable end-to-end for a personal account across sessions.

## Milestone checklist

- [x] Accounts/login/session persistence.
  - Smoke: `npm run smoke:sprint4` checks sign-in/log-out UI tokens and `quest-coder:session` persistence wiring.
- [x] Database schema for content and player progress.
  - Smoke: `docs/DATABASE_SCHEMA.md` contains users, quest packs, challenges, progress, attempts, and timelines.
- [x] Library by category.
  - Smoke: page includes `Library by category` and renders challenges from the Timequake pack.
- [x] Quest unlock flow.
  - Smoke: page includes unlock checks and boss unlock status; boss requires all quest IDs.
- [x] Saved code per quest.
  - Smoke: page persists `savedCode` under `quest-coder:profile:<user>`.
- [x] Attempts saved with results and timeline pointer.
  - Smoke: page records attempt status, replay case, event count, and timeline pointer.
- [x] Hidden reference solution opened only on request and recorded.
  - Smoke: solution scroll is hidden until opened and records `solutionOpened`.
- [x] Boss fight test rounds and victory replay.
  - Smoke: `/api/run` runs the boss from pack content and passing code returns `passed` with replay events.

## Acceptance checks

- [x] User signs in, starts a question, clears quests, beats boss, logs out/in, and progress remains.
- [x] Boss unlocks only after all quests clear.
- [x] Attempt history is visible enough for debugging.
- [x] Result states match PRD R6-R14 through the existing runner/status set.

## Commands

```bash
npm run smoke:sprint4
```

Full Sprint 4 verification gate:

```bash
npm run test:runner
npm run typecheck
npm run build
npm run smoke:sprint2
npm run smoke:sprint3
npm run smoke:sprint4
```
