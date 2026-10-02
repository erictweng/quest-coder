# Quest Coder UI/UX Redesign Brief

Source: Eric's Sprint 10 direction and attached NeetCode-style reference screenshot.

## Routing

All Quest Coder UI/UX updates and documentation should be routed to Discord channel `1555044301363355658` (`quest-coder-ux-ui`).

Current tool limitation: the available Discord tool can fetch messages and create threads, but does not expose a send-message action. Until that is available, UI/UX documentation is written into the repo and summarized back in the active chat.

## Core UX correction

The current app shows too much at once. The redesign should separate the product into three high-level areas before opening the coding screen:

1. **Profile**
   - Player identity / handle.
   - XP, shards, streak, bosses defeated.
   - Recent attempts and review due count.
   - Settings for indexing/social visibility later.

2. **Campaign**
   - RPG-style progression map or campaign list.
   - Packs grouped by topic/category.
   - Shows unlock progress and boss availability.
   - Clicking a campaign opens its question list.

3. **Questions list**
   - Compact list/table/cards of quests and boss fights.
   - Shows status: locked, available, cleared, review due.
   - Does not show editor, replay, reward panels, or full stats until a question is selected.

Once a question is selected, the question page becomes the main game screen.

## Question screen reference

The attached reference is a NeetCode/LeetCode-style dark split-pane editor layout.

### Information hierarchy

Primary focus:

- Left half: question text and examples.
- Right half: code editor/compiler.

Secondary / optional:

- Animation/replay panel is hidden or collapsed by default.
- Hints, solution, submissions, discussion, and animation tabs are accessible but not front-and-center.
- Rewards/stats should appear as small completion feedback, not permanent page clutter.

### Layout proportions

Desktop question page:

```text
┌────────────────────────────────────────────────────────────────────┐
│ Top bar: Quest Coder / Campaign / nav / profile                    │
├───────────────────────────────┬────────────────────────────────────┤
│ Question pane                 │ Code/compiler pane                 │
│ ~45–50% width                 │ ~50–55% width                      │
│                               │                                    │
│ Tabs:                         │ Language selector / run controls   │
│ Question | Animation | Hints  │ Editor tab                         │
│                               │                                    │
│ Title                         │ Code editor                        │
│ difficulty / concepts         │                                    │
│ problem statement             │                                    │
│ examples                      │                                    │
│ constraints                   │                                    │
│                               ├────────────────────────────────────┤
│                               │ Console/results drawer             │
│                               │ Run / Submit buttons               │
└───────────────────────────────┴────────────────────────────────────┘
```

Default desktop sizing:

- Question pane: `minmax(420px, 48%)`.
- Editor pane: `minmax(520px, 52%)`.
- Bottom console drawer: collapsed by default, expands after Run/Submit.
- Animation panel: left-pane tab or bottom drawer, not always visible.

Mobile/tablet:

- Use tabs/stacked panes.
- Default tab order: Question → Code → Result → Animation.
- Keep Run/Submit sticky at bottom.

### Visual style

Use the screenshot as the baseline direction:

- Dark theme.
- Dense but readable editor-first layout.
- Thin borders and panel dividers.
- Muted neutral background, not a huge colorful dashboard.
- Accent colors only for status, difficulty, active tabs, and run/submit actions.
- Top nav should be compact.
- Code pane should feel like a real IDE, with line numbers and console drawer.

Quest Coder-specific styling can keep the game feel, but the question screen should prioritize solving flow over dashboard decoration.

## Retro pixel / bit-character aesthetic

The product should feel like a retro pixel RPG layered over a focused coding interface.

### Art direction

Design target: **Cyberpunk Bit** — the midpoint between **Pac-Man** maze clarity and **Undertale** encounter framing.

Cyberpunk Bit means Quest Coder should feel like a dark neon arcade-coding terminal: maze districts, pellet/progress nodes, power-node hints, glitch patrol/failing-test pressure, firewall bosses, compact dialogue panels, and a professional split-pane code editor. This is an original adaptation of broad design principles; do not copy Pac-Man or Undertale assets, characters, fonts, UI, sound effects, exact colors, or layouts.

- **Style:** retro, pixel-art, bit-character, cyberpunk arcade terminal UI.
- **Mood:** energetic, readable, slightly weird, encouraging, and high-contrast instead of fantasy or horror.
- **Pac-Man energy:** maze readability, pellet rhythm, power nodes, score clarity, cute pressure from chasers.
- **Undertale energy:** focused encounter screen, dark bordered panels, short character dialogue, clear choices, optional battle/animation space.
- **Characters:** small pixel operator / glitch patrols / firewall bosses can represent topics, review reminders, failing tests, and victory states.
- **UI chrome:** panels should feel like neon arcade terminals or encounter boxes while preserving the split-pane coding workflow.
- **Animation:** subtle terminal glows, packet traces, reward bursts, firewall clear flashes, and node unlocks. Avoid constant motion that distracts from solving.
- **Detailed spec:** see `docs/UI_UX_FLOW_AND_AESTHETIC.md` and `docs/CYBERPUNK_BIT_AESTHETIC.md`.

### Visual tokens

- **Typography:** keep readable code/editor fonts for code, but use pixel display fonts for headers, labels, badges, quest titles, and reward moments.
- **Edges:** use crisp borders, stepped corners, low-radius cards, and 1–2px pixel-like dividers.
- **Colors:** dark game-console base with restrained neon accents.
  - Background: deep navy / almost black.
  - Panel fill: slate/indigo-black.
  - Primary accent: cyan/teal for active states.
  - Reward accent: gold/yellow for XP and shards.
  - Danger/boss accent: red/magenta.
  - Success accent: green.
- **Icons:** prefer pixel glyphs/sprites over smooth generic icons.
- **Texture:** use subtle grid, scanline, CRT glow, or tiled dungeon-map accents sparingly.

### Where pixel style belongs

Use pixel styling strongly in:

- Profile avatar and stat bar.
- Campaign map/cards.
- Question list status badges.
- Boss cards.
- Reward toasts.
- Animation/replay scene.
- Empty states and loading states.

Use pixel styling lightly in:

- Code editor.
- Problem statement text.
- Console output.

The editor still needs to feel professional and readable. The bit aesthetic should frame the solving experience, not reduce code readability.

### Reference flow with aesthetic

- Landing page: pixel RPG hub with three choices — Profile, Campaign, Questions.
- Campaign page: overworld/map or quest board with pixel nodes.
- Question page: NeetCode-like split pane with pixel RPG chrome.
- Animation tab: strongest pixel-art moment, with bit characters/data-structure enemies/portals.

## New navigation model

### Home route

Purpose: choose where to go, not solve a question.

Sections:

- Profile card.
- Campaign progress card/list.
- Due reviews card.
- Continue last question shortcut.

Avoid:

- Full replay theater.
- Huge code editor.
- Full reward/social panels.
- Full stats dashboard.

### Campaign route

Purpose: pick a pack/campaign.

Sections:

- Campaign title and short story.
- Quest list.
- Boss card.
- Progress and unlock states.

### Question route

Purpose: solve one challenge.

Sections:

- Split-pane question/compiler layout.
- Optional tabs: Question, Animation, Hints, Solution, Submissions.
- Console/result drawer.
- Completion/reward toast after success.

Candidate routes:

- `/` — profile/campaign landing.
- `/campaigns` — campaign list.
- `/campaigns/[packSlug]` — question list for one campaign.
- `/campaigns/[packSlug]/questions/[challengeId]` — focused solving screen.

## Question screen behavior

1. User lands on Profile/Campaign dashboard.
2. User selects a campaign.
3. User selects a question.
4. App opens focused split-pane screen.
5. User reads question on the left and writes code on the right.
6. User runs code.
7. Console drawer opens with status, failing case, budget, and error.
8. User may open Animation tab to understand the trace.
9. User submits/passes.
10. Small reward/status feedback appears, then progress updates.

## What moves off the front page

Move these out of the landing page:

- Full code editor.
- Replay theater.
- Reward shop details.
- Friend shell.
- Full attempt history.
- Full per-topic stats.

Keep them accessible in context:

- Editor only on question screen.
- Replay/animation only after selecting a question or run result.
- Rewards as a compact profile stat and completion toast.
- Attempt history inside question/submissions tab or profile.

## Acceptance criteria for the redesign

- First screen does not overwhelm with all systems at once.
- User can clearly choose: Profile, Campaign, Questions.
- Selecting a question opens a dedicated solve view.
- Dedicated solve view uses a two-pane layout: question left, compiler right.
- Compiler occupies about half the screen.
- Question occupies about half the screen.
- Animation/replay is optional and discoverable, not mandatory clutter.
- Existing runner, pack, progress, rewards, and review systems remain intact.
- Sprint 2–9 smoke tests still pass or are intentionally updated to match the new routes.

## Implementation phases

### Phase 1 — Route and state split

- Extract current monolithic `app/page.tsx` into reusable modules.
- Add route-level screens for profile/campaign/question.
- Preserve localStorage progress model.

### Phase 2 — Focused question layout

- Build NeetCode-style split screen.
- Left pane: problem statement, examples, constraints, tabs.
- Right pane: code editor, result drawer, Run/Submit.
- Move replay into optional Animation tab/drawer.

### Phase 3 — Polish and verification

- Update smoke tests to assert the new flow.
- Capture screenshots for landing, campaign list, question solve view, animation drawer, and result drawer.
- Post verification in `quest-coder-ux-ui` once Discord send capability is available.
