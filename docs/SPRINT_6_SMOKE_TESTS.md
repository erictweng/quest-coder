# Sprint 6 Smoke Tests

Sprint 6 adds review and reinforcement on top of the personal dojo loop.

## Milestone checklist

- [x] Stale-review scheduler.
  - Smoke: `npm run smoke:sprint6` checks scheduled review records, `nextDueAt`, interval days, and due-review UI.
- [x] Review variants in packs.
  - Smoke: every quest pack has `review.enabled`, `defaultSchedule`, and at least one review variant.
- [x] Surprise battle selection from studied topics.
  - Smoke: checks the Surprise Battle UI and guard that no unstudied topic can be selected.
- [x] Per-topic stats.
  - Smoke: checks defeated count, attempts, hint/solution use, streak, and rating UI/logic.
- [x] Snooze/preview controls for review pressure.
  - Smoke: checks preview action and one-day snooze state.

## Acceptance checks

- [x] Beaten boss returns on a spaced schedule through `scheduleReview`.
- [x] Easy wins lengthen interval; losses/hint-heavy wins shorten interval and rating.
- [x] Surprise battle appears only from eligible studied topics.
- [x] Stats update from real local attempts recorded by the runner flow.

## Commands

```bash
npm run smoke:sprint6
```

Full Sprint 6 verification gate:

```bash
npm run test:runner
npm run typecheck
npm run build
npm run smoke:sprint2
npm run smoke:sprint3
npm run smoke:sprint4
npm run smoke:sprint5
npm run smoke:sprint6
```
