Quest Coder PRD extracted by Hermes read_file from PDF.

Quest Coder is a web app that turns each LeetCode or NeetCode problem into a short RPG story: two to eight mini quests that each solve one piece of the problem, ending in a boss battle against the full problem.

Goals:
1. Every question in the library is broken into 2 to 8 quests with a story, ending in a boss battle against the full problem.
2. Every code run can be watched as an animation against each test, showing variables, data movement, and the failing line.
3. A player can always tell the difference between a failed test, a crash, and code that did not compile.
4. Progress, attempts, and stats are saved to the player's account.
5. Surprise battles and stale reviews bring back old topics and problems on a schedule.
6. Adding a question is a content task, not an engineering task.

Non-goals for this PRD:
- Languages other than Python.
- Copying LeetCode or NeetCode problem text.
- Any real game's characters, art, or UI.

Deferred:
- Reward system.
- Stat bar.
- Friend list/social.

Core product loop:
- Question library -> story intro -> quests unlock one by one -> boss fight -> victory replay -> review loop.

Quest pack contains:
- Metadata.
- Story.
- Quests.
- Tests.
- Budgets.
- Boss.
- Scene spec.
- Review set.

Visual bar:
- Variables are characters.
- Data moves visibly.
- Code panel follows along line by line.
- Every outcome has a different visual.
- Wrong answers show the correct answer.
- Big inputs switch to compact views.
- Player controls time.

Functional requirements:
R1 Accounts; R2-R3 Library; R4 Quests; R5 Editor; R6-R9 Running/sandbox; R10-R11 Animation; R12 Boss; R13-R14 Progress; R15-R16 Review; R17 Stats; R18-R19 Content pipeline; R20 Public hardening; R21 Rewards; R22 Social.

Architecture:
- Browser never runs player code.
- API sends every run to an isolated sandbox.
- Sandbox returns pass/fail results plus a timeline.
- Two-pass runs: untraced pass/fail first, trace replay tests second.
- Timelines are the contract between sandbox and scene renderer.
- Read-counting wrappers enforce complexity budgets.
- Quest packs are validated before loading.

Risks:
- Untrusted code on server.
- Visual quality varies by question.
- Each question takes real work to author.
- Copyrighted problem text.
- Server runs feel slower than in-browser runs.
- Line tracing slows code.
- Timelines are large.
- Review schedule feels random or nagging.

Open questions:
- Real app name.
- Reward currency and spend targets.
- Boss failure cost or free retry.
- Review intervals.
- Whether viewing reference solution lowers rewards/blocks boss.
- First library/order.
- Tech stack.
- Whether packs export as standalone dojo pages.
