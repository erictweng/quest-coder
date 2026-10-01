# Quest Coder UI/UX Redesign Sprint Plan

Source docs:

- `docs/FRONTEND_REDESIGN_PRD.md`
- `docs/UI_UX_FLOW_AND_AESTHETIC.md`
- `docs/UI_UX_REDESIGN_BRIEF.md`

Routing rule: all UI/UX updates and documentation should be routed to Discord channel `1555044301363355658` (`quest-coder-ux-ui`) when send-message tooling is available.

## Objective

Redesign the Quest Coder frontend from a dense all-in-one dashboard into a focused retro pixel RPG learning flow:

```text
Hub → Campaign → Questions List → Focused Question Solve Screen
```

The target aesthetic is **Undertale-like, but happier**: retro pixel RPG framing, friendly bit characters, cheerful dark palette, readable coding surfaces, and progressive disclosure.

## Sprint sequence

## Sprint 10 — IA shell and state extraction

Goal: split the monolithic frontend into named app surfaces without changing behavior yet.

Skills to load:

- `quest-coder-ui-ux`
- `progressive-disclosure-product-ia`
- `coding-editor-ux`

Milestones:

- Extract reusable pack/challenge/progress helpers from `app/page.tsx`.
- Define screen state or route boundaries for:
  - Hub
  - Profile
  - Campaigns
  - Campaign detail/question list
  - Question solve screen
- Preserve current localStorage progress shape.
- Preserve saved code, attempts, unlocks, review records, reward wallet, and social shell state.
- Add smoke tests that assert screen boundaries exist.

Acceptance criteria:

- Existing Sprint 2–9 functional gate still passes or has intentional test updates.
- Landing state can render without showing full editor/replay dashboard.
- Selecting a question can still reach the current solve functionality.
- No progress data is lost across reload.

Verification:

```bash
npm run typecheck
npm run build
npm run smoke:sprint9
```

Browser checks:

- Hub renders.
- Existing selected-question flow still works.
- Reload preserves profile/progress.

## Sprint 11 — Hub, profile card, and campaign entry

Goal: make the first screen calm and action-oriented.

Skills to load:

- `quest-coder-ui-ux`
- `progressive-disclosure-product-ia`
- `pixel-rpg-product-design`
- `gamified-learning-loops`

Milestones:

- Build Hub screen with three primary cards:
  - Profile
  - Campaign
  - Questions
- Add Continue Last Quest CTA.
- Add compact stats strip:
  - XP
  - Shards
  - streak/rating
  - bosses defeated
  - reviews due
- Add one companion dialogue bubble.
- Move full editor/replay/rewards/social details off the Hub.
- Add Profile surface with player card, rewards, recent attempts, review reminders.

Acceptance criteria:

- First screen does not show full editor.
- First screen does not show full replay theater.
- User can choose Profile, Campaign, or Questions within 5 seconds.
- Rewards/stats are compact, not dashboard-heavy.
- Pixel RPG tone is visible but not noisy.

Verification:

```bash
npm run typecheck
npm run build
npm run smoke:sprint9
```

Browser screenshots:

- Hub.
- Profile card.
- Continue Last Quest CTA.

## Sprint 12 — Campaign map and questions list

Goal: turn question selection into a quest-board/campaign flow.

Skills to load:

- `quest-coder-ui-ux`
- `pixel-rpg-product-design`
- `progressive-disclosure-product-ia`
- `gamified-learning-loops`
- `stylized-accessibility-checks`

Milestones:

- Build Campaigns screen.
- Build Campaign detail screen for one pack/topic.
- Show quest nodes or compact quest board with statuses:
  - locked
  - available
  - cleared
  - review due
  - boss
- Show boss gate status.
- Add topic/concept tags.
- Add completion percent and review due count.
- Add Questions list filter set:
  - All
  - Available
  - Cleared
  - Review
  - Boss

Acceptance criteria:

- Selecting a campaign does not immediately show the editor.
- Selecting a quest opens focused solve mode.
- Locked/available/cleared/review/boss states are visually distinct and labeled.
- Campaign page feels like pixel RPG progression without hurting scan speed.

Verification:

```bash
npm run typecheck
npm run build
npm run smoke:sprint9
```

Browser screenshots:

- Campaign list.
- Campaign detail quest map/board.
- Questions list with filters.

## Sprint 13 — Focused split-pane solve screen

Goal: make the selected question the main game screen.

Skills to load:

- `quest-coder-ui-ux`
- `coding-editor-ux`
- `progressive-disclosure-product-ia`
- `stylized-accessibility-checks`

Milestones:

- Build desktop split-pane layout:
  - left pane: Question
  - right pane: Code/compiler
- Left pane tabs:
  - Question
  - Animation
  - Hints
  - Solution
  - Submissions
- Right pane includes:
  - code editor
  - language/runtime badge
  - Run action
  - Submit/Boss action
  - console/result drawer
- Keep Animation hidden until requested.
- Keep Hints/Solution secondary.
- Preserve saved code per challenge.
- Preserve `/api/run` integration.

Acceptance criteria:

- Question/problem is on the left.
- Compiler/code is on the right.
- Each side uses roughly half the desktop screen.
- User can solve without opening animation.
- Run result appears in editor-connected drawer.
- Existing runner and result states still work.

Verification:

```bash
npm run test:runner
npm run typecheck
npm run build
npm run smoke:sprint2
npm run smoke:sprint7
npm run smoke:sprint9
```

Browser screenshots:

- Question tab + editor.
- Failed run result drawer.
- Passed run result drawer.

## Sprint 14 — Contextual animation, replay, rewards, and review moments

Goal: move advanced systems into the right moments instead of showing them permanently.

Skills to load:

- `quest-coder-ui-ux`
- `coding-editor-ux`
- `gamified-learning-loops`
- `pixel-rpg-product-design`
- `stylized-accessibility-checks`

Milestones:

- Move replay theater into Animation tab/drawer.
- After failed run, result drawer suggests `View Animation`.
- Show compact reward toast after quest clear.
- Show larger but brief boss victory moment.
- Show unlock animation for next quest/campaign node.
- Move attempt history into Submissions tab or Profile.
- Keep review due state visible in Hub/Profile/Campaign, not as solve-screen clutter.

Acceptance criteria:

- Animation/replay is optional and discoverable.
- Rewards are visible after clears but do not block continued solving.
- Attempt history is accessible but not front-page clutter.
- Review reminders guide the user without nagging.
- Reduced-motion preference is respected or animation can be disabled.

Verification:

```bash
npm run typecheck
npm run build
npm run smoke:sprint5
npm run smoke:sprint6
npm run smoke:sprint8
npm run smoke:sprint9
```

Browser screenshots:

- Animation tab.
- Reward toast.
- Boss victory state.
- Submissions/attempt history surface.

## Sprint 15 — Pixel RPG visual system and accessibility pass

Goal: apply the Undertale-but-happier visual system consistently and verify usability.

Skills to load:

- `quest-coder-ui-ux`
- `pixel-rpg-product-design`
- `stylized-accessibility-checks`
- `coding-editor-ux`

Milestones:

- Add reusable visual tokens:
  - `void` `#070814`
  - `night` `#0D1024`
  - `panel` `#141833`
  - `panel-2` `#1B2142`
  - `border` `#E8E2C8`
  - `border-muted` `#3A416A`
  - `text` `#FFF7D6`
  - `text-muted` `#B8B6D9`
  - `cyan` `#5DEBFF`
  - `teal` `#36D399`
  - `gold` `#FFD166`
  - `pink` `#FF6FAE`
  - `red` `#FF4D6D`
  - `green` `#7CFF6B`
  - `purple` `#A78BFA`
- Add pixel panel/button/dialogue primitives.
- Add sprite/bit-character placeholders.
- Add visible focus states.
- Check color contrast for primary surfaces.
- Ensure no pixel font is used in code or long problem text.
- Add responsive mobile tab layout check.

Acceptance criteria:

- UI reads as retro pixel RPG.
- Mood reads as **Undertale-like, but happier**.
- Code editor remains professional and readable.
- Question body remains readable.
- Status states do not rely on color alone.
- Keyboard focus is visible.
- Motion is brief and optional/controllable.

Verification:

```bash
npm run typecheck
npm run build
npm run smoke:sprint9
```

Browser screenshots:

- Hub visual system.
- Campaign map visual system.
- Solve screen desktop.
- Solve screen mobile/narrow viewport.

## Sprint 16 — Regression, smoke-test rewrite, and final UI/UX verification

Goal: lock the redesigned frontend with tests, screenshots, and docs.

Skills to load:

- `quest-coder-ui-ux`
- `web-app-qa-workflows`
- `stylized-accessibility-checks`
- `software-quality-workflow`

Milestones:

- Update smoke tests for new IA/routes.
- Preserve core Sprint 2–9 assertions where still relevant.
- Add new UI/UX smoke test for:
  - Hub choices
  - Campaign selection
  - Question list selection
  - Split-pane solve screen
  - Optional animation tab
  - Result drawer
  - reward toast
- Run full regression gate.
- Capture final verification screenshots.
- Update PRD/sprint docs if implementation diverges.

Acceptance criteria:

- Full functional gate passes.
- New UI/UX smoke test passes.
- Screenshots prove the key flow.
- Documentation matches actual UI.
- Update summary is ready for `quest-coder-ux-ui`.

Verification:

```bash
npm run test:runner
npm run typecheck
npm run build
npm run smoke:sprint2
npm run smoke:sprint3
npm run smoke:sprint4
npm run smoke:sprint5
npm run smoke:sprint6
npm run smoke:sprint7
npm run smoke:sprint8
npm run smoke:sprint9
npm run smoke:ui-redesign
```

Browser screenshots:

- Hub.
- Campaigns.
- Campaign detail.
- Question solve screen.
- Animation tab.
- Result drawer.
- Reward/victory moment.

## Cross-sprint guardrails

- Do not redesign the backend runner during UI/UX sprints.
- Do not remove existing Sprint 2–9 capabilities.
- Do not show the full editor on first load.
- Do not make animation mandatory.
- Do not use pixel fonts in code or long problem text.
- Do not clone Undertale assets, characters, exact UI, or copy.
- Keep Quest Coder original: coding RPG, not fan art.

## Definition of done for the UI/UX redesign

- First screen is Profile/Campaign/Questions focused.
- Campaign flow feels like a pixel RPG map/quest board.
- Question solve screen is split-pane with problem left and code right.
- Animation/replay is optional and contextual.
- Rewards/reviews/stats are contextual and not front-page clutter.
- Visual system is tokenized and consistently applied.
- Accessibility/readability checks pass.
- Full regression gate passes.
- Final screenshots are captured and ready to share in `quest-coder-ux-ui`.
