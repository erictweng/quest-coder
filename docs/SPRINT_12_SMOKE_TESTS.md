# Sprint 12 Smoke Tests

Sprint 12 turns question selection into a quest-board/campaign flow.

## Milestone checklist

- [x] Campaigns screen exists.
- [x] Campaign detail screen exists for one pack/topic.
- [x] Quest nodes / compact quest board show states:
  - locked
  - available
  - cleared
  - review due
  - boss
- [x] Boss gate status is visible.
- [x] Topic/concept tags are visible.
- [x] Completion percent/count and review due markers are visible.
- [x] Questions list filter set exists:
  - All
  - Available
  - Cleared
  - Review
  - Boss

## Acceptance checks

- [x] Selecting a campaign does not immediately show the editor.
- [x] Selecting a quest opens focused solve mode.
- [x] Locked/available/cleared/review/boss states are visually distinct and labeled.
- [x] Campaign page feels like pixel RPG progression without hurting scan speed.

## Commands

```bash
npm run smoke:sprint12
```
