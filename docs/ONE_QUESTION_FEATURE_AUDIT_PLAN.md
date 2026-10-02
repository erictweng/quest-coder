# One-Question Feature Audit + Implementation Plan

## Current target

Quest Coder is now intentionally focused on one active problem at a time. The active question is:

- Pack: `forest-of-patience-climbing-stairs`
- Category: `1-DP`
- Topic: Dynamic Programming
- Problem: Climbing Stairs

This plan audits the current implementation against the requested feature direction and defines the implementation order.

## Reference UI reading

The attached reference uses a dense coding-workspace layout:

- Very small global top bar.
- Main workspace is editor-first.
- Question/support material sits in a panel, not as the dominant permanent shell.
- Run and Submit stay attached to the compiler/output area.
- The question content can be consulted while coding, but the code surface is the product focus.
- Dark editor zone has minimal decoration and high contrast.

Quest Coder should emulate the structure, not the branding:

- Keep the Cyberpunk Bit theme, but reduce chrome in solve mode.
- Make coding feel full-screen.
- Move quest/question info into a pop-out notebook.
- Keep the top bar thin and utilitarian.

## Audit findings

### Backend audit

#### 1. Run vs Submit are not separate yet

Current state:

- `app/page.tsx` has one `submit` function.
- Both `Run` and `Submit` buttons call the same function.
- `/api/run` accepts `source`, `packSlug`, and `challengeId`; it does not accept a mode.
- `runner/quest_runner_cli.py` loads every fixed test for the challenge.
- `runner/quest_runner.py` runs all tests in the fast pass, then traces one replay case.

Gap:

- `Run` should execute only the basic/public test cases.
- `Submit` should execute all test cases.
- One mid-complex case should be the only animated replay case.
- Current runner chooses replay automatically: first failed case, otherwise first test. It does not honor `tests.replayCaseIds` yet.

#### 2. Test data needs public/submit/replay structure

Current state:

- Climbing Stairs has `tests.fixed` and `tests.replayCaseIds`.
- There is no formal split between basic tests and full submit tests.
- The runner ignores `replayCaseIds`.

Gap:

Need a schema like:

```json
"tests": {
  "run": [...basic cases...],
  "submit": [...all cases...],
  "replayCaseId": "boss-10"
}
```

Compatibility option:

- Keep `fixed` temporarily as an alias for submit tests while migrating.

#### 3. Problem descriptions are too thin

Current state:

- Each quest has a short `brief`.
- The UI renders only the brief in the Question tab.
- The pack contains learning goals and hints, but no structured problem statement.

Gap:

Each quest should include:

- Simple explanation of the problem.
- Gamified explanation.
- General inputs.
- General output goal.
- Constraints/guarantees.
- Two examples with input, output, and explanation.

This should apply to every quest/boss, but the user-facing active problem should feel like one coherent Climbing Stairs question.

#### 4. Solution reveal is not safely confirmed

Current state:

- Clicking the Solution tab calls `openSolution()` immediately.
- The solution panel uses `<details open={Boolean(progress.solutionOpened[id])}>`.
- There is also a `Load passing` button in the editor that inserts the reference solution directly.

Gap:

- The solution should never display until the user confirms.
- The tab click should open a confirmation prompt/panel, not the solution.
- `Load passing` should be removed from normal player UI or put behind the same confirmation gate.
- If confirmed, mark the attempt as solution-assisted.

### Frontend audit

#### 1. Quest panel takes too much permanent space

Current state:

- Solve mode uses a split layout: question/support on the left, compiler on the right.
- Quest path, tabs, prompt, animation, hints, solution, and submissions all live in the left pane.

Gap:

- The compiler should own the screen for now.
- Quest description/questions should live in a bottom-right fixed **quest notebook** icon.
- Clicking the notebook opens a pop-out/overlay panel.
- User can bounce between the prompt and code without sacrificing editor space.

#### 2. Top bar is still too large

Current state:

- Solve mode still has a sizeable header panel.
- It says workspace mode and uses a large card with account controls.
- Non-solve nav is hidden in solve mode.

Gap:

- Top module should be a very small persistent strip.
- Include a `Home` control in that top strip.
- Keep login/logout compact.
- The top module should feel merged into the workspace, not like a dashboard card.

#### 3. Compiler is not full-screen enough

Current state:

- Editor pane is about half the layout.
- Console/result drawer exists below the editor.
- Run and Submit are both present, but both call the same backend behavior.

Gap:

- In solve mode, the compiler should be the main full-width/full-height surface.
- The notebook overlays the compiler when opened.
- Run and Submit should be visually distinct and behaviorally distinct.
- The animation should appear only for the single mid-complex replay case.

## Implementation plan

### Milestone 1 — Data schema for one-question mode ✅ Complete

Implemented in commit work after this plan:

- Added `oneQuestionMode` pack marker.
- Added structured `problem` objects to every Climbing Stairs quest and boss.
- Added `tests.run`, `tests.submit`, and `tests.replayCaseId` to every challenge.
- Kept `tests.fixed` as a compatibility alias for the current runner.
- Expanded `npm run smoke:climbing-stairs` to enforce the new schema.

Files:

- `content/packs/forest-of-patience-climbing-stairs.json`
- `scripts/climbing-stairs-smoke.mjs`
- `docs/CLIMBING_STAIRS_QUEST_DRAFT.md`

Acceptance verified:

- `npm run smoke:climbing-stairs`
- `npm run typecheck`
- `npm run build`
- `npm run smoke:sprint3`
- `npm run smoke:ui-redesign`

### Milestone 2 — Backend run/submit split

Files:

- `app/api/run/route.ts`
- `runner/quest_runner_cli.py`
- `runner/quest_runner.py`
- `scripts/climbing-stairs-smoke.mjs`

Work:

1. Add request field:

```ts
mode: "run" | "submit"
```

2. `/api/run` behavior:
   - `run`: use `tests.run`
   - `submit`: use `tests.submit`
3. Runner behavior:
   - Always execute the selected suite.
   - Trace exactly one mid-complex replay case from `tests.replayCaseId` when available.
   - Do not trace every case.
4. Response should include:
   - `mode`
   - `suiteSize`
   - `replayCaseId`
   - `cases`
5. Frontend should call:
   - Run button → `mode: "run"`
   - Submit button → `mode: "submit"`

Acceptance:

- Run returns only basic cases.
- Submit returns all cases.
- Animation/replay always uses the configured single mid-complex case.
- Existing compile/runtime/wrong-answer handling still works.

### Milestone 3 — Problem statement content pass

Files:

- `content/packs/forest-of-patience-climbing-stairs.json`
- `app/page.tsx`
- `docs/CLIMBING_STAIRS_QUEST_DRAFT.md`

Work:

1. Rewrite Climbing Stairs prompt content into the requested format:
   - plain English problem explanation
   - gamified Forest of Patience framing
   - inputs
   - output
   - two examples
   - constraints/guarantees
2. Render the structured problem in the notebook instead of a single `brief` paragraph.
3. Keep quest titles short and useful.
4. Do not overload the prompt with DP solution details; save solution mechanics for hints/solution.

Acceptance:

- The question is understandable without opening hints.
- The problem statement says what the input is and what output is expected.
- There are two visible examples.
- The story supports the problem instead of replacing it.

### Milestone 4 — Confirm-before-solution gate

Files:

- `app/page.tsx`
- `scripts/ui-redesign-smoke.mjs`
- `scripts/climbing-stairs-smoke.mjs`

Work:

1. Replace immediate solution reveal with a confirmation panel.
2. Clicking `Solution` should show:
   - warning that this marks the attempt solution-assisted
   - `Cancel`
   - `Reveal solution`
3. Only `Reveal solution` calls `openSolution()`.
4. Remove or gate `Load passing` behind the same confirmation.
5. Track `solutionOpened` only after confirmation.

Acceptance:

- Opening the Solution tab alone does not show code.
- Confirmation is required before any solution code appears.
- Attempt history still marks solution-assisted after reveal.

### Milestone 5 — Full-screen compiler workspace

Files:

- `app/page.tsx`
- `app/globals.css`
- `scripts/ui-redesign-smoke.mjs`

Work:

1. Replace solve split-pane with editor-first layout:
   - thin top bar
   - full-width compiler/editor
   - console drawer at bottom
   - Run/Submit attached to compiler controls
2. Add compact top controls:
   - Home
   - active question title
   - progress/status
   - sign in/out compact control
3. Keep `Home` visible in solve mode.
4. Reduce top module height and padding.
5. Preserve Cyberpunk Bit styling but remove decorative clutter from editor area.

Acceptance:

- Editor dominates the viewport.
- Top bar is small.
- Home is available from solve mode.
- Console remains accessible.
- Run and Submit remain visible.

### Milestone 6 — Bottom-right Quest Notebook overlay

Files:

- `app/page.tsx`
- `app/globals.css`
- `scripts/ui-redesign-smoke.mjs`

Work:

1. Add state:

```ts
const [questNotebookOpen, setQuestNotebookOpen] = useState(false)
```

2. Add fixed bottom-right icon button:
   - label: `Quest Notebook`
   - accessible name: `Open quest notebook`
   - static while scrolling
3. Clicking opens an overlay/pop-out panel.
4. Notebook contains:
   - quest path/questions
   - structured problem statement
   - examples
   - hints
   - animation access
   - submissions
   - gated solution confirm flow
5. Add close button and Escape-key close if practical.

Acceptance:

- Notebook button is fixed bottom-right.
- Notebook can open/close without leaving the editor.
- Editor remains visible behind or beside overlay.
- The problem/question content is not permanently taking half the page.

### Milestone 7 — One-question QA pass

Files:

- `scripts/one-question-workspace-smoke.mjs`
- `package.json`
- screenshots under `docs/`

Work:

1. Add a dedicated smoke test for one-question workflow.
2. Verify:
   - only Climbing Stairs is listed
   - solve mode has Home
   - quest notebook button exists
   - solution does not reveal without confirmation
   - Run uses basic tests
   - Submit uses all tests
   - replay case is the configured mid-complex case
3. Capture screenshots:
   - full-screen compiler closed notebook
   - notebook open with problem statement/examples
   - run result with basic tests
   - submit result with all tests
   - confirmation gate before solution reveal

Acceptance:

- Smoke passes.
- Typecheck/build passes.
- Screenshots show the reference-aligned layout.

## Recommended build order

1. **Milestone 1:** Data schema and problem content scaffolding.
2. **Milestone 2:** Backend run/submit/replay behavior.
3. **Milestone 4:** Solution reveal safety gate.
4. **Milestone 5:** Full-screen compiler layout.
5. **Milestone 6:** Quest notebook overlay.
6. **Milestone 3 content polish** can happen alongside Milestone 5/6 once the notebook surface exists.
7. **Milestone 7:** Final QA.

Reasoning:

- Backend mode split should land before UI buttons are redesigned around it.
- Solution safety should land before polishing the notebook.
- The notebook needs structured content to render cleanly.
- QA should verify behavior, not just screenshots.

## Risks / decisions needed

### Keep quests vs one canonical question

Current pack has three learning quests plus a boss. The user said one question at a time, but also said quests should explain the problem in gamified format.

Recommended interpretation:

- Keep one active problem pack: Climbing Stairs.
- Treat the quests as guided stages inside that one problem.
- The final boss is the canonical LeetCode-style function.
- Do not add other problem packs until Climbing Stairs is fully polished.

### Run button semantics

Recommended:

- `Run` = basic public examples + one medium replay animation.
- `Submit` = all tests, still returns the one configured replay animation for feedback.

If Submit should not animate at all, that should be decided before Milestone 2.

### Solution button semantics

Recommended:

- `Solution` opens a warning gate.
- `Reveal solution` shows solution and marks assisted.
- `Cancel` returns to notebook without revealing.
- Remove `Load passing` from player-facing UI.
