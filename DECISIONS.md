# Quest Coder Decisions

Sprint 0 decision log. These are locked for Sprint 1 unless a later sprint explicitly revisits them.

## Product name

**Decision:** Keep `Quest Coder` for the MVP.

**Why:** The name is clear enough for internal/personal MVP work, and naming should not block the engine spike.

## MVP stack

**Decision:** Use a Next.js + TypeScript app shell with a separate Python sandbox runner service.

- Frontend/app shell: Next.js App Router, TypeScript, React.
- Styling: Tailwind CSS.
- App data for personal MVP: Postgres via Prisma later; Sprint 1 may use local files/fixtures only.
- Runner: server-side CPython, isolated behind an API boundary.
- Replay: browser renderer consumes a JSON timeline contract returned by the runner.
- Pack format: checked-in JSON quest packs first; database-backed ingestion comes after the schema/validator works.

**Why:** This keeps the replay UI in Eric's familiar React/TypeScript lane while preserving the PRD rule that player code never runs in the browser.

## Runtime and safety posture

**Decision:** Sprint 1 runner is a local development sandbox spike, not public-safe infrastructure.

- No public users until Sprint 7 hardening.
- Sprint 1 proves tracing, result classification, read budgets, and timeline shape.
- Public execution later requires container or microVM isolation, no network, read-only filesystem, CPU/memory/time limits, queueing, rate limits, and abuse tests.

## First problem and first library order

**Decision:** First boss/problem remains Timequake/Search in Rotated Sorted Array.

After that, the first library expansion is linked lists:

1. Reverse Linked List
2. Merge Two Sorted Lists
3. Linked List Cycle

**Why:** Search in Rotated Array proves array/binary-search replay. Linked lists then force the renderer and read-counting model to handle pointers/portals instead of only indices.

## Review intervals

**Decision:** Use simple spaced-review defaults for MVP:

- First clear: review tomorrow.
- Clean review win: 3 days, then 7 days, then 14 days, then 30 days.
- Failed review, crash, compile error, or solution-assisted clear: back to tomorrow.
- Heavy hint use: cap next interval at 3 days.
- User can snooze once, but snoozed items remain visible in review state.

**Why:** Predictable intervals are easier to debug than an adaptive algorithm. The data model can later store quality signals and compute smarter schedules.

## Reward placeholder model

**Decision:** MVP grants XP plus a cosmetic placeholder currency, with no shop yet.

- Quest clear: XP.
- Boss clear: larger XP grant plus cosmetic currency.
- Solution-assisted clears grant reduced rewards/stats credit.
- Rewards are presentation/state only until the core learning loop works.

**Why:** This supports motivation and future economy work without adding shop design to the critical path.

## Boss retry model

**Decision:** Boss failures are free retries with attempt history only.

- No cooldown.
- No quest-chain reset.
- No direct penalty beyond the failed attempt being recorded.

**Why:** The learning loop should encourage debugging. Punitive boss failures would push users toward guessing less and experimenting less.

## Reference solution behavior

**Decision:** A player may open the reference solution before beating the boss, but the clear is marked `solution_assisted` and receives reduced rewards/stats credit.

**Why:** Blocking the solution fights the teaching goal. Marking assisted clears preserves honest progress signals.

## Standalone dojo export

**Decision:** Keep standalone dojo export as a later compatibility target, not a Sprint 1 requirement.

- Sprint 1 focuses on server runner output and timeline contract.
- The quest-pack schema should not prevent later standalone export.

## Original-content rule

**Decision:** Quest packs must use original problem text, stories, names, and art direction.

**Why:** The PRD explicitly excludes copying LeetCode/NeetCode text and any real game's characters, art, logos, maps, or UI.

## Remaining non-blocking questions

No Sprint 1 blockers remain after Eric's Sprint 0 answers. Later sprints still need detailed visual theme choices, account/auth provider choice, deployment target, and production sandbox provider.