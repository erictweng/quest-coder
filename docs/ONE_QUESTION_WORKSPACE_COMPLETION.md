# One-Question Workspace Completion

## Scope

Completed the remaining one-question milestones for the active Climbing Stairs pack.

Active problem:

- Pack: `forest-of-patience-climbing-stairs`
- Category: `1-DP`
- Topic: Dynamic Programming
- Problem: Climbing Stairs

## Completed milestones

### Milestone 2 — Backend run/submit split

Implemented separate runner modes:

- `Run basic` sends `mode: "run"`.
- `Submit all` sends `mode: "submit"`.
- `/api/run` forwards mode to `runner/quest_runner_cli.py`.
- `runner/quest_runner_cli.py` selects `tests.run` or `tests.submit`.
- `runner/quest_runner.py` returns execution metadata:
  - `mode`
  - `suiteSize`
  - `replayCaseId`
- The replay/animation case uses the configured single `tests.replayCaseId`.

### Milestone 3 — Structured problem content rendering

The Quest Notebook now renders structured prompt content from the pack:

- plain problem statement
- gamified Forest of Patience statement
- inputs
- output
- guarantees
- two examples

### Milestone 4 — Confirm-before-solution gate

Solution reveal is now gated:

- Opening the Solution tab does not reveal code.
- User must press `I want to view the solution`.
- User then sees a confirmation panel.
- Only `Reveal solution` opens the solution and marks future clears as solution-assisted.
- The old player-facing `Load passing` shortcut was removed.

### Milestone 5 — Full-screen compiler workspace

Solve mode now centers the compiler:

- thin sticky top bar
- visible `Home` control
- full-width editor surface
- `Run basic` and `Submit all` controls attached to the compiler
- console/result drawer under the editor
- editor remains dark, monospace, and free of decorative assets

### Milestone 6 — Bottom-right Quest Notebook overlay

Added bottom-right fixed Quest Notebook:

- `📓 Quest Notebook` button stays fixed while coding
- opens a pop-out overlay
- contains quest path, problem prompt, animation, hints, solution gate, and submissions
- can be closed without leaving the compiler

### Milestone 7 — QA and smoke coverage

Added dedicated smoke command:

```bash
npm run smoke:one-question-workspace
```

It checks:

- only Climbing Stairs is active
- full-screen compiler exists
- bottom-right Quest Notebook exists
- solution confirmation gate exists
- structured problem content exists
- Run uses basic tests and Submit uses full tests
- both modes use the configured replay case

## Verification

Passed:

```bash
npm run smoke:one-question-workspace
npm run smoke:climbing-stairs
npm run smoke:ui-redesign
npm run smoke:cyberpunk-solve
npm run smoke:cyberpunk-bit
npm run typecheck
npm run build
```

## Screenshot artifacts

- `docs/one-question-workspace-compiler.png`
- `docs/one-question-workspace-notebook-question.png`
- `docs/one-question-workspace-solution-gate.png`
- `docs/one-question-workspace-run-basic.png`
- `docs/one-question-workspace-submit-all.png`
- `docs/one-question-workspace-animation.png`
