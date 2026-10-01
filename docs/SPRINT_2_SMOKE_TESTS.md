# Sprint 2 Smoke Tests

Sprint 2 requires repeatable smoke tests after each milestone. This file records the milestone checks for the replay theater web shell.

## Milestone checklist

- [x] React app shell with question page.
  - Smoke: `npm run smoke:sprint2` checks the Sprint 2 title and question/editor shell in `app/page.tsx`.
- [x] Code editor with line numbers, Tab/Shift+Tab, auto-indent, Ctrl/Cmd+Enter, ligatures off.
  - Smoke: `npm run smoke:sprint2` checks editor keyboard handlers and ligature-off styling.
- [x] API endpoint or local service bridge to submit code to runner.
  - Smoke: `npm run smoke:sprint2` verifies `/api/run` is wired to `runner/quest_runner_cli.py` and the CLI returns a failing replay.
- [x] Replay player consumes timeline contract.
  - Smoke: `npm run smoke:sprint2` submits the reference solution and asserts line/read/outcome events plus `mid` variable movement.
- [x] Array scene: doors for small inputs, skyline for large inputs.
  - Smoke: `npm run smoke:sprint2` checks both scene modes are present and the runner provides the input payload.
- [x] Outcome visuals for found, not found, wrong answer, crash, compile error, off-end, loop guard, over budget.
  - Smoke: `npm run smoke:sprint2` drives fixture submissions for passed, wrong answer, compile error, runtime error, off-end read, loop guard, and over budget, and checks UI mappings.
- [x] Playback controls: play, pause, step, back, skip, speed.
  - Smoke: `npm run smoke:sprint2` checks the playback controls and speed cycle are wired.
- [x] UI responsive for capped 3,000-step timeline.
  - Smoke: `npm run smoke:sprint2` asserts the runner cap is 3,000 and the replay does not exceed it.

## Command

```bash
npm run smoke:sprint2
```

Full Sprint 2 verification gate:

```bash
npm run test:runner
npm run typecheck
npm run build
npm run smoke:sprint2
```

## Latest result

Run during Sprint 2 implementation after wiring the app shell and bridge. Keep this section updated when milestone smoke tests change.

```text
ok - React app shell with question page
ok - Code editor keyboard contract
ok - API/local service bridge submits code to runner
ok - Replay player consumes timeline contract
ok - Array scene doors and skyline
ok - Outcome visuals for every Sprint 2 status
ok - Playback controls
ok - 3,000-step cap responsiveness
ok - Sprint 2 smoke doc is wired
```

## Notes

The bridge still uses the Sprint 1 local CPython runner. It is for local development only; Sprint 7 owns public-safe sandbox isolation.
