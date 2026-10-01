# Quest Coder Sprint / Milestone Plan

Source: `docs/Quest_Coder_PRD.pdf`, provided `coding-dojo` skill, and the existing Quest Coder build map.

## Product north star

A player can choose a question, clear 2–8 small RPG-flavored quests, fight the full boss problem, and replay every run visually enough to explain the algorithm afterward.

The animation/replay engine is the product. Everything else exists to get more high-quality quest packs through that loop.

## Planning assumptions

- Primary language: Python only.
- First user: Eric/builder only.
- Public launch comes after sandbox hardening and original problem text review.
- First app stack should bias toward Eric's current strengths unless deliberately changed:
  - React/TypeScript frontend.
  - Postgres-backed app data.
  - Server-side CPython sandbox runner.
  - Timeline contract between sandbox and replay renderer.
- The `coding-dojo` skill is the content/runner prototype reference, not the production architecture.

## Milestone overview

### Sprint 0 — Product decisions and repo foundation

Goal: remove blockers that make architecture ambiguous.

Deliverables:
- Decide real app name or keep `Quest Coder` for MVP.
- Decide stack for MVP.
- Choose first library order.
- Choose initial review intervals.
- Decide reward placeholder model.
- Create product repo skeleton.
- Capture the timeline contract draft.
- Capture quest-pack schema draft.

Acceptance criteria:
- `DECISIONS.md` exists and answers every open PRD question needed before Sprint 1.
- `ARCHITECTURE.md` contains the chosen stack and runtime boundaries.
- `docs/timeline-format.md` has a first version of the sandbox-to-scene event schema.
- `docs/quest-pack-schema.md` has a first version of pack metadata, quests, tests, budgets, boss, scene spec, and review set.

### Sprint 1 — Server-side engine spike

Goal: prove the dojo loop can run in server CPython with real tracing and read budgets.

Deliverables:
- Isolated local sandbox runner prototype.
- Four result types: did not compile, crashed, failed test, passed.
- Read-counting wrappers for arrays/lists.
- `sys.settrace` timeline capture.
- Two-pass execution: fast untraced pass/fail, traced replay pass.
- Time/memory guard prototype.
- Reference Timequake/Search-in-Rotated-Array boss running through the server runner.

Acceptance criteria:
- Reference solution passes fixed and random tests within budget.
- Linear scan returns correct answer but fails budget on large tests.
- Syntax error, runtime error, infinite loop, and off-the-end read return distinct structured results.
- Timeline includes line number, tracked vars, reads, and final outcome.

### Sprint 2 — Replay theater web shell

Goal: port the dojo's visible replay into the app shell without accounts yet.

Deliverables:
- React app shell with question page.
- Code editor with line numbers, Tab/Shift+Tab, auto-indent, Ctrl/Cmd+Enter, ligatures off.
- API endpoint or local service bridge to submit code to runner.
- Replay player consumes timeline contract.
- Array scene: doors for small inputs, skyline for large inputs.
- Outcome visuals for found, not found, wrong answer, crash, compile error, off-end, loop guard, over budget.
- Playback controls: play, pause, step, back, skip, speed.

Acceptance criteria:
- First failing test opens automatically.
- Passing run can play a victory replay.
- At least one failure and one passing replay visually match line/variable movement.
- UI remains responsive for capped 3,000-step timeline.

### Sprint 3 — Quest pack pipeline

Goal: make adding a question a content operation instead of an engineering operation.

Deliverables:
- Quest-pack JSON/YAML schema.
- Timequake quest pack converted from dojo format.
- Pack validator runs reference solutions in sandbox.
- Scene-render smoke check for every quest and boss.
- Loader inserts/serves validated content.
- Original-text checklist in validator/review process.

Acceptance criteria:
- Broken reference solution causes pack rejection.
- Missing scene spec causes pack rejection.
- Timequake pack loads without code changes.
- The app can run every quest and boss from the pack.

### Sprint 4 — Personal MVP app loop

Goal: Eric can use the app end to end across sessions.

Deliverables:
- Accounts/login/session persistence.
- Database schema for content and player progress.
- Library by category.
- Quest unlock flow.
- Saved code per quest.
- Attempts saved with results and timeline pointer.
- Hidden reference solution opened only on request and recorded.
- Boss fight test rounds and victory replay.

Acceptance criteria:
- User signs in, starts a question, clears quests, beats boss, logs out/in, and progress remains.
- Boss unlocks only after all quests clear.
- Attempt history is visible enough for debugging.
- Result states match PRD R6-R14.

### Sprint 5 — First library and linked-list scene

Goal: expand beyond Timequake into the first usable practice set.

Deliverables:
- Linked-list portal/island scene renderer.
- Reverse Linked List quest pack.
- Merge Two Sorted Lists quest pack.
- Linked List Cycle quest pack.
- Library contains at least 5 total questions when combined with Timequake and one additional pack.
- Visual quality review checklist for each pack.

Acceptance criteria:
- Eric clears 5 questions end to end.
- Every boss replay meets the visual bar in the PRD.
- Pointer movement/relinking is visible for linked-list problems.

### Sprint 6 — Review and reinforcement

Goal: make practice stick beyond one-time completion.

Deliverables:
- Stale-review scheduler.
- Review variants in packs.
- Surprise battle selection from studied topics.
- Per-topic stats: defeated, attempts, hint/solution use, streaks/rating.
- Snooze/preview controls for review pressure.

Acceptance criteria:
- Beaten boss returns on a spaced schedule.
- Easy wins lengthen interval; losses/hint-heavy wins shorten it.
- Surprise battle appears only from eligible studied topics.
- Stats update from real attempts.

### Sprint 7 — Security and public-readiness hardening

Goal: make it safe to let strangers run code.

Deliverables:
- Container/microVM isolation strategy implemented.
- No-network, read-only filesystem, CPU/memory/time limits enforced.
- Rate limits and abuse protection.
- Queue visibility/progress while runs execute.
- Timeline compression/storage retention policy.
- Original-problem-text audit for all public packs.
- Public signup/onboarding path.

Acceptance criteria:
- Sandbox security review passes documented checks.
- Abuse tests cannot exhaust runner/API without hitting limits.
- Public content does not copy LeetCode/NeetCode text.
- Public sign-up works at planned scale.

### Sprint 8 — Rewards/social polish

Goal: add deferred motivation systems after the core learning loop works.

Deliverables:
- Reward currency model.
- Quest/boss reward grant events.
- Spend target placeholder or shop/progression concept.
- Stat bar.
- Friend list/social shell if still wanted.

Acceptance criteria:
- Rewards reinforce practice without undermining learning.
- Reward outcomes are visible after quests/bosses.
- Social features are optional and do not block solo use.

## Critical path

1. Stack decision.
2. Sandbox runner.
3. Timeline format.
4. Trace/read counting/two-pass runs.
5. Replay player.
6. Timequake server boss gate.
7. Quest-pack format + validator.
8. Accounts/progress/API.
9. Five-question personal MVP gate.
10. Review/stats/security gates.
11. Public launch.

## First execution recommendation

Start with Sprint 0 and Sprint 1 only. Do not build accounts or polished UI before the server runner proves that timelines can explain failures at dojo quality.
