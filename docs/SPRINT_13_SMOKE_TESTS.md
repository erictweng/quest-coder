# Sprint 13 Smoke Tests

Sprint 13 makes a selected question the focused game screen.

## Milestone checklist

- [x] Desktop solve layout is a split pane.
- [x] Left pane is the question/support pane.
- [x] Right pane is the code/compiler pane.
- [x] Left pane tabs exist:
  - Question
  - Animation
  - Hints
  - Solution
  - Submissions
- [x] Code pane includes:
  - Python runtime badge
  - editor
  - Run action
  - Submit/Boss action
  - console/result drawer
- [x] Animation stays hidden behind a tab until requested.
- [x] Hints and solution stay secondary.
- [x] Saved code and `/api/run` integration are preserved.

## Acceptance checks

- [x] Question/problem appears on the left.
- [x] Compiler/code appears on the right.
- [x] Editor uses readable monospace, not pixel typography.
- [x] Run/Submit controls are obvious.
- [x] Result drawer explains when to open Animation after a failure.

## Commands

```bash
npm run smoke:sprint13
```
