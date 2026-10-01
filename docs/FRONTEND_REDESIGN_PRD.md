# Quest Coder Frontend Redesign PRD

Status: draft for implementation planning  
Owner: Quest Coder UI/UX  
Routing: all UI/UX work updates and documentation should be posted in Discord channel `1555044301363355658` (`quest-coder-ux-ui`) when send-message tooling is available.

## 1. Summary

Quest Coder's current frontend proves the full learning loop, but it exposes too many systems at once: profile, campaign, code editor, replay theater, rewards, review stats, social shell, attempts, and launch metadata all compete on the same screen.

The redesign turns the product into a calmer retro RPG learning flow:

1. The user starts in a simple hub: **Profile**, **Campaign**, and **Questions**.
2. The user selects a campaign or question.
3. The app opens a focused solve screen.
4. The solve screen uses a NeetCode-style split layout:
   - left half: question/problem content
   - right half: code/compiler
5. Animation/replay, hints, solutions, results, rewards, and stats become contextual, optional surfaces instead of front-page clutter.

The visual direction is **Undertale-like, but happier**: retro pixel RPG framing, friendly bit characters, warm dark panels, simple dialogue boxes, cheerful accents, and readable coding surfaces.

## 2. Problem

The current frontend is functionally rich but visually overloaded.

### Current pain points

- The front page shows too much information at once.
- The code editor appears before the user has chosen a question.
- Replay/animation, rewards, review stats, friend shell, attempts, and campaign selection compete for attention.
- The app feels more like a feature dashboard than a game flow.
- The current layout does not match the desired solve experience: question left, code/compiler right.
- The game aesthetic is present but not yet defined enough to guide frontend decisions.

### User direction

Eric's stated direction:

- The app should start with **Profile**, **Campaign**, and **Questions list**.
- Once a question is selected, the selected question should become the highlight of the game.
- The solve UI should be similar to the attached NeetCode-style screenshot:
  - code question on the left
  - code/compiler on the right
  - compiler takes about half the screen
  - question takes about half the screen
- Animations should be available if the user wants more information, but not forced front-and-center.
- The aesthetic should be retro, pixel, bit-character style.
- The final direction is **Undertale, but happier**.

## 3. Goals

### Product goals

1. Reduce cognitive load on first open.
2. Make question selection feel like choosing a quest.
3. Make the coding screen focused and productive.
4. Preserve the existing Quest Coder learning loop:
   - quest packs
   - unlock flow
   - runner
   - replay timeline
   - boss fights
   - review loop
   - rewards
5. Make the product feel like a cohesive retro RPG, not a generic coding dashboard.

### UX goals

1. First screen clearly offers three choices: Profile, Campaign, Questions.
2. The user never sees the full editor until they select a question.
3. The focused solve screen is a split-pane workspace.
4. Animation/replay is discoverable but optional.
5. Rewards and stats appear at the right moments instead of occupying permanent space.
6. The interface is keyboard- and mobile-aware.

### Visual goals

1. Establish a durable visual language: **Undertale-like, but happier**.
2. Use retro pixel UI framing without harming readability.
3. Use bit characters and RPG dialogue to add warmth.
4. Keep code/problem surfaces professional and readable.
5. Use a defined color/token system so implementation is consistent.

## 4. Non-goals

- Do not redesign the backend runner in this PRD.
- Do not add new programming languages.
- Do not introduce multiplayer/social mechanics beyond the existing optional shell.
- Do not clone Undertale art, characters, UI, music, or copyrighted assets.
- Do not copy LeetCode/NeetCode problem text.
- Do not make the code editor look like a toy.
- Do not force animations before or during every run.
- Do not remove existing Sprint 2–9 functionality; reorganize it.

## 5. Target users

### Primary user

A self-directed learner practicing algorithms who wants:

- a clear question flow
- visual debugging help
- a game-like sense of progress
- serious coding surfaces
- less overwhelm than a full dashboard

### Secondary user

A returning learner who wants to:

- continue the last quest
- clear reviews
- track progress
- fight bosses for topics they have studied

## 6. Design principles

### 6.1 Pixel RPG frame, professional coding core

The game world frames the experience. The editor and problem text remain practical.

Strong pixel styling belongs in:

- hub
- campaign map
- quest cards
- boss cards
- reward moments
- animation/replay scenes
- companion dialogue

Light pixel styling belongs in:

- code editor shell
- problem panel borders
- console drawer

No pixel font inside code.

### 6.2 Reveal complexity only when needed

The frontend should reveal systems in layers:

1. Hub choices.
2. Campaign/question selection.
3. Focused solve screen.
4. Results/replay/hints/rewards in context.
5. Deep stats/history only from profile or submissions.

### 6.3 Solving is the main event

The selected question screen is the center of the product. Everything on that screen should help the user solve or understand one problem.

### 6.4 Animation is a power tool, not clutter

Replay is a differentiator, but it should be opt-in on the solve screen.

Default state:

- show question and editor
- hide animation behind tab/drawer

After failed run:

- expose result drawer
- offer animation/replay as the next best step

### 6.5 Happy challenge, not punishment

Failure copy should be playful but not shamey. Bosses should feel exciting, not hostile.

## 7. Information architecture

### Proposed routes

- `/` — Hub: Profile / Campaign / Questions / Continue.
- `/profile` — Player card, rewards, streak, attempts, reviews.
- `/campaigns` — Campaign list / overworld map.
- `/campaigns/[packSlug]` — Campaign detail and question list.
- `/campaigns/[packSlug]/questions/[challengeId]` — Focused solve screen.

If route implementation needs to be incremental, the same IA can be simulated inside one app state first, then split into routes later.

## 8. User flows

### 8.1 First session flow

1. User opens `/`.
2. Hub shows three primary cards: Profile, Campaign, Questions.
3. Companion dialogue explains the next action in one line.
4. User selects Campaign.
5. User chooses the first campaign: Timequake / binary search.
6. User sees a quest path and selects the first available quest.
7. Focused solve screen opens.
8. User reads the question on the left and codes on the right.
9. User runs code.
10. Result drawer opens.
11. User can open Animation if needed.
12. User clears quest and sees compact reward toast.
13. Next quest unlocks.

### 8.2 Returning session flow

1. User opens `/`.
2. Hub shows Continue Last Quest and Due Review.
3. User clicks Continue.
4. Solve screen opens exactly where they left off.
5. Saved code loads.
6. Attempts/submissions are available from a tab/drawer.

### 8.3 Campaign progression flow

1. User opens Campaigns.
2. User picks a campaign/topic.
3. Campaign detail shows pixel map with nodes.
4. Cleared nodes are green/gold.
5. Locked nodes are muted.
6. Review due nodes pulse purple.
7. Boss node appears at the end.
8. Boss unlocks only when prerequisite quests are cleared.

### 8.4 Failure-to-understanding flow

1. User runs incorrect code.
2. Console drawer opens with:
   - status
   - failing case
   - expected vs actual
   - error line if available
3. App offers: View Animation.
4. User opens Animation tab.
5. Replay shows data movement and code line progression.
6. User returns to Code tab and fixes the solution.

### 8.5 Victory/reward flow

1. User passes a quest.
2. Small toast appears: `Clean clear. +40 XP.`
3. If boss cleared, larger but brief victory panel appears.
4. Campaign node unlock animation plays.
5. User can continue to next quest or return to campaign.

## 9. Page requirements

### 9.1 Hub page

Purpose: orient the user.

Required elements:

- Top nav with Quest Coder title and profile handle.
- Three primary cards:
  - Profile
  - Campaign
  - Questions
- Continue Last Quest CTA.
- Compact stats strip:
  - XP
  - Shards
  - streak
  - bosses defeated
  - reviews due
- One companion dialogue bubble.

Must not show:

- full code editor
- full replay theater
- full reward shop
- full attempt history
- full stats dashboards

### 9.2 Profile page

Purpose: save file / player card.

Required elements:

- Player handle/avatar.
- XP and Shards.
- Streak/rating.
- Bosses defeated.
- Recent attempts.
- Review due count.
- Optional friend/social shell.
- Settings/visibility later.

### 9.3 Campaigns page

Purpose: pick a world/topic.

Required elements:

- Campaign cards or overworld map.
- Topic tags.
- Completion percent.
- Boss status.
- Review due count.
- Pixel campaign art/character.

### 9.4 Campaign detail page

Purpose: choose a quest inside one campaign.

Required elements:

- Campaign title/story intro.
- Quest path or quest board.
- Question nodes with statuses:
  - locked
  - available
  - cleared
  - review due
  - boss
- Short question previews.
- Boss gate status.

### 9.5 Question solve page

Purpose: solve one challenge.

Desktop required layout:

- Left pane: 45–50% width.
- Right pane: 50–55% width.
- Compact top nav.
- Left panel tabs:
  - Question
  - Animation
  - Hints
  - Solution
  - Submissions
- Right panel:
  - language selector
  - code editor
  - Run button
  - Submit/Boss button
  - result console drawer

Left pane default tab: Question.  
Right pane default: Code editor.  
Animation hidden until selected.

Mobile required layout:

- Tabbed single-column view:
  - Question
  - Code
  - Result
  - Animation
- Sticky Run/Submit button.
- Preserve code readability.

## 10. Visual system

### 10.1 Aesthetic direction

Direction: **Undertale-like, but happier**.

Borrow:

- pixel simplicity
- dark panels
- white/cream dialogue borders
- character-driven flavor text
- battle/encounter framing
- minimal choices

Brighten with:

- warmer accents
- friendlier sprites
- cyan/teal/gold/pink palette
- cozy campaign map energy
- encouraging copy
- softer success/reward moments

Avoid:

- horror tone
- dreary monochrome
- excessive scanlines
- constant flashing
- toy-like editor

### 10.2 Color tokens

| Token | Hex | Use |
|---|---:|---|
| `void` | `#070814` | main background |
| `night` | `#0D1024` | page/panel background |
| `panel` | `#141833` | cards, modals, sidebars |
| `panel-2` | `#1B2142` | elevated panels/editor gutters |
| `border` | `#E8E2C8` | Undertale-like dialogue border, used sparingly |
| `border-muted` | `#3A416A` | normal panel borders |
| `text` | `#FFF7D6` | primary warm text |
| `text-muted` | `#B8B6D9` | secondary copy |
| `cyan` | `#5DEBFF` | active tab, cursor, selection, run accent |
| `teal` | `#36D399` | available/healthy states |
| `gold` | `#FFD166` | XP, rewards, unlocked moments |
| `pink` | `#FF6FAE` | friendly boss/personality accent |
| `red` | `#FF4D6D` | errors, danger, boss warning |
| `green` | `#7CFF6B` | pass/success |
| `purple` | `#A78BFA` | campaign magic/review accent |

### 10.3 Semantic colors

- Available quest: cyan/teal.
- Cleared quest: green + gold marker.
- Locked quest: muted gray/purple.
- Review due: purple pulse/star.
- Boss: pink/red/gold.
- Run action: cyan.
- Submit/Boss action: gold or pink.
- Error: red with readable console text.
- Hint: purple.
- Solution-assisted: gold warning, not shame.

### 10.4 Typography

Use two typography lanes:

1. Pixel display font:
   - headers
   - quest labels
   - buttons
   - badges
   - reward moments
   - dialogue bubbles

2. Readable code/content font:
   - problem text
   - editor
   - console
   - test results

Rules:

- No pixel font for long problem paragraphs.
- No pixel font inside code editor.
- Use pixel display labels sparingly.
- Keep code ligatures off.

### 10.5 Components

#### Pixel panels

- Dark fill.
- 1–2px crisp borders.
- Squared or lightly stepped corners.
- Optional double-border for dialogue/boss panels.

#### Dialogue bubbles

Used for:

- companion tips
- campaign intro
- boss intro
- empty states
- reward moments

Length: 1–2 lines.

#### Buttons

- Pixel button base.
- Strong focus state.
- Pressed state shifts 1–2px down/right.
- Primary: cyan.
- Boss/submit: gold/pink.
- Dangerous: red.

#### Sprites / bit characters

Use for:

- profile avatar
- campaign guide
- bosses
- review reminders
- loading/empty states

Sprites should support the flow, not block it.

## 11. Functional requirements

### FR1 — Hub simplification

The landing page must show Profile, Campaign, and Questions as the primary choices and must not display the full editor/replay dashboard by default.

### FR2 — Question selection flow

Selecting a question from Campaign or Questions must open a dedicated solve screen scoped to that challenge.

### FR3 — Split-pane solve screen

The solve screen must place question content on the left and code/compiler on the right at desktop widths.

### FR4 — Optional animation

Animation/replay must be accessible from the solve screen but hidden/collapsed by default.

### FR5 — Contextual results

Run results must appear in a drawer or panel connected to the editor, not as global dashboard content.

### FR6 — Progress preservation

Existing progress, saved code, attempts, rewards, review state, and unlock state must continue to work after the redesign.

### FR7 — Campaign map/list

Campaign detail must show quests and boss state in a scan-friendly pixel RPG format.

### FR8 — Aesthetic tokenization

The redesign must implement or prepare a reusable color/token system matching this PRD.

### FR9 — Responsive behavior

Desktop uses split panes. Mobile/tablet uses tabs/stacked panes with sticky run actions.

### FR10 — Accessibility/readability

Problem text, code editor, console, and result output must remain readable and navigable.

## 12. Non-functional requirements

- Existing runner behavior must not regress.
- Existing smoke tests must either pass or be intentionally updated for the new IA.
- UI must remain responsive with capped 3,000-event timelines.
- Keyboard flow must support editor usage.
- Color contrast should be checked for primary surfaces.
- Motion should respect reduced-motion preference.
- The layout should not require horizontal scrolling on common laptop widths.

## 13. Content/copy guidelines

Tone: short, game-like, encouraging.

Good examples:

- `Quest unlocked.`
- `Boss gate is open.`
- `Try one more trace.`
- `Your pointer wandered off the map.`
- `Clean clear. +40 XP.`

Avoid:

- long corporate dashboard copy
- shamey failure language
- ominous horror lines
- walls of tutorial text

## 14. Implementation plan

### Phase 1 — IA shell

- Extract current monolithic page into reusable state/helpers/components.
- Create Hub, Campaign, Question List, and Question Solve screen boundaries.
- Keep route splitting optional if faster to implement as state first.
- Preserve localStorage progress model.

### Phase 2 — Focused solve screen

- Build split-pane question/code layout.
- Move replay into Animation tab/drawer.
- Move run result into editor-connected console drawer.
- Keep hints/solution/submissions accessible but secondary.

### Phase 3 — Pixel visual system

- Add color tokens.
- Add pixel panel/button/dialogue styles.
- Add sprite/bit-character placeholders.
- Add campaign node/boss visual states.

### Phase 4 — Regression and QA

- Update smoke tests to assert new flow.
- Run full Sprint 2–9 gate.
- Capture screenshots:
  - Hub
  - Campaigns
  - Campaign detail/question list
  - Question solve screen
  - Animation tab
  - Result drawer
- Route UI/UX update summary to `quest-coder-ux-ui` when Discord send tooling is available.

## 15. Acceptance criteria

### UX acceptance

- First screen is calm and has three obvious choices: Profile, Campaign, Questions.
- Selecting a campaign shows a quest map/list, not the editor.
- Selecting a question opens the dedicated solve screen.
- Solve screen has question left and compiler/code right.
- Compiler/code takes roughly half the screen.
- Question takes roughly half the screen.
- Animation/replay is optional and discoverable.
- Rewards/stats do not clutter the solve screen.

### Visual acceptance

- The product reads as retro pixel RPG.
- The specific mood reads as Undertale-like, but happier.
- Color system uses the defined dark base with cyan/teal/gold/pink accents.
- Pixel characters/panels are visible in hub/campaign/reward/animation moments.
- Code editor and problem content remain highly readable.

### Technical acceptance

- Existing quest packs still load.
- `/api/run` still works.
- Saved code still works.
- Attempts still record.
- Progress/unlocks still work.
- Review scheduler still works.
- Rewards still work.
- Full relevant smoke gate passes after route/test updates.

## 16. Risks and mitigations

### Risk: pixel aesthetic hurts readability

Mitigation: keep pixel font out of code/problem body and reserve it for labels, buttons, and flavor.

### Risk: route split breaks existing localStorage state

Mitigation: preserve current progress shape and extract state helpers before moving UI.

### Risk: smoke tests fail because they expect old page text

Mitigation: intentionally update smoke tests to target new IA while preserving core functional assertions.

### Risk: animation becomes hidden and users miss the differentiator

Mitigation: after failed runs, show a clear `View Animation` suggestion in the result drawer.

### Risk: Undertale inspiration becomes too derivative

Mitigation: borrow only broad principles: pixel framing, dialogue boxes, encounter structure. Use original sprites, palette, copy, and layouts.

## 17. Open questions

1. Should the first implementation use real routes immediately, or a state-driven single-page flow first?
2. Do we want one persistent pixel companion character across the whole app?
3. Should campaigns be displayed as maps first, cards first, or both depending viewport?
4. What should the first boss sprite style be for Timequake?
5. Should reward shop/social remain hidden until after the core redesign is stable?

## 18. Source docs

- `docs/UI_UX_REDESIGN_BRIEF.md`
- `docs/UI_UX_FLOW_AND_AESTHETIC.md`
- `docs/PRD_EXTRACTED_SUMMARY.md`
- `docs/SPRINTS_AND_MILESTONES.md`
