# Quest Coder UI/UX Flow and Visual System

Direction: **Undertale-like, but happier**, now specialized as **Sky-Island Academy** — a bright pixel-fantasy coding academy in the clouds with warmth, humor, readable panels, bit characters, and a focused coding flow.

This document expands `docs/UI_UX_REDESIGN_BRIEF.md` into a concrete flow, aesthetic, and color scheme. The detailed Sky-Island implementation layer lives in `docs/SKY_ISLAND_PIXEL_AESTHETIC.md`.

## Product feeling

Quest Coder should feel like opening a cheerful retro RPG where algorithm questions are quests and data structures are little worlds.

The vibe is not grim dungeon crawler and not corporate coding platform. It is:

- Retro pixel RPG.
- Cozy game-console interface.
- Friendly, slightly weird, character-driven.
- Focused enough for serious coding.
- Happier and brighter than Undertale while borrowing its simple pixel framing, character dialogue energy, and battle/encounter structure.
- Visually grounded in **Sky-Island Academy**: floating islands, cloud paths, warm wood signs, lantern quest nodes, and sky gates for bosses.

## Core metaphor

- **Profile** = save file / player card.
- **Campaign** = overworld / quest map.
- **Questions list** = quest board / encounter list.
- **Question solve screen** = battle screen + code terminal.
- **Animation/replay** = battle animation / enemy pattern reveal.
- **Tests** = encounters.
- **Boss** = final challenge for a campaign.
- **XP/Shards** = post-battle rewards.
- **Review due** = old monsters returning for a rematch.

## UX flow

### 1. Landing / Hub

Goal: orient the player without showing every system.

Primary choices:

1. **Profile**
   - Player card.
   - XP, shards, streak, bosses defeated.
   - Recent attempts.
   - Review reminders.

2. **Campaign**
   - Campaign cards or pixel overworld map.
   - Each campaign shows topic, completion percent, boss status, and review due count.

3. **Questions**
   - A compact list of available questions.
   - Filters: available, cleared, review due, boss.

Also include:

- Continue last quest.
- Small pixel companion dialogue bubble with one helpful line.

Do not include:

- Full code editor.
- Full replay theater.
- Full reward shop.
- Full stats dashboard.

### 2. Campaign screen

Goal: choose a topic world.

Layout:

- Top: campaign title, topic, progress, boss status.
- Middle: pixel map / quest path.
- Right or lower panel: campaign description and unlock rules.
- Quest nodes show locked / available / cleared / review due.
- Boss node sits at the end as a larger sprite/card.

Interaction:

- Click a quest node to open the focused solve screen.
- Click boss only when unlocked.
- Hover/focus shows a short question preview, not full problem text.

### 3. Questions list

Goal: scan and select a problem quickly.

Layout:

- Dense but friendly list/table.
- Columns/cards:
  - title
  - concept tags
  - difficulty
  - status
  - last attempt
  - reward / review marker

Interaction:

- Selecting a row opens the question solve screen.
- Filters should be simple: All, Available, Cleared, Review, Boss.

### 4. Question solve screen

Goal: solve one problem with minimal distraction.

This is the main game screen after selection.

Desktop layout:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Compact top bar: Quest Coder / Campaign / Question / Profile                │
├────────────────────────────────────┬─────────────────────────────────────────┤
│ QUESTION PANEL                     │ CODE PANEL                              │
│ 45–50% width                       │ 50–55% width                            │
│                                    │                                         │
│ Tabs: Question | Animation | Hints │ Language + Run/Submit                   │
│                                    │                                         │
│ Pixel dialogue intro               │ Code editor                             │
│ Problem statement                  │                                         │
│ Examples                           │                                         │
│ Constraints                        │                                         │
│                                    ├─────────────────────────────────────────┤
│                                    │ Console/result drawer                    │
└────────────────────────────────────┴─────────────────────────────────────────┘
```

Required behavior:

- Question text stays on the left.
- Code/compiler takes about half the screen on the right.
- Result drawer opens after Run/Submit.
- Animation/replay is opt-in via tab or drawer.
- Hints and solution are available but not visually dominant.

Mobile layout:

- Tabs: Question → Code → Result → Animation.
- Sticky Run/Submit action bar.
- Keep problem text and code in separate views to avoid cramped layout.

### 5. Result / reward moment

After run:

- Failed run: console drawer opens with short message and failing case.
- Passed quest: small happy reward toast.
- Passed boss: bigger pixel victory moment, but short.
- Unlock next quest/campaign node with a small animation.

Rewards should be visible, not noisy.

## Aesthetic: Undertale, but happier

Borrow from Undertale:

- Pixel-art simplicity.
- Black/dark panels.
- White bordered dialogue boxes.
- Character-driven flavor text.
- Battle/encounter framing.
- Minimal UI that makes each choice clear.

Make it happier by adding:

- Warmer accent colors.
- Friendlier sprites.
- More cyan/teal/gold than red/white only.
- Cozy overworld/campaign map energy.
- Encouraging copy instead of ominous copy.
- Softer success/reward moments.

Avoid:

- Horror tone.
- Dreary monochrome everywhere.
- Heavy scanlines that hurt readability.
- Too many flashing effects.
- Making the code editor look like a toy.

## Color scheme

### Core palette

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

### Semantic use

- **Available quest:** cyan / teal.
- **Cleared quest:** green + small gold reward mark.
- **Locked quest:** muted purple/gray.
- **Review due:** purple + gentle pulsing star.
- **Boss:** pink/red/gold, not pure danger red.
- **Run button:** cyan.
- **Submit/Boss fight:** gold or pink depending context.
- **Errors:** red with clear console text.
- **Hints:** purple.
- **Solution-assisted:** amber/gold warning, not shameful.

## Typography

Use two lanes:

1. **Pixel display font**
   - Headers.
   - Quest labels.
   - Campaign cards.
   - Buttons.
   - Reward toasts.
   - Dialogue bubbles.

2. **Readable code/content font**
   - Problem body.
   - Code editor.
   - Console.
   - Test results.

Rules:

- Never use the pixel font for long problem paragraphs.
- Never use pixel font inside the code editor.
- Keep body line length comfortable.
- Use uppercase pixel labels sparingly.

Existing fonts can map as:

- `Press Start 2P` → display labels / tiny headers only.
- `VT323` or readable mono → flavor text and terminal-like copy.
- Code editor → stable monospace with ligatures off.

## Component language

### Pixel panels

- 1–2px borders.
- Crisp, squared or lightly stepped corners.
- Dark fill.
- Optional double-border for important dialogue/boss panels.
- Avoid glossy glassmorphism.

### Buttons

- Pixel button base.
- Clear hover/focus states.
- Pressed state shifts 1–2px down/right.
- Primary action: cyan or gold.
- Dangerous action: red.

### Dialogue bubbles

Used for:

- companion tips.
- campaign intro.
- boss intro.
- empty states.
- reward moments.

Should be short: 1–2 lines.

### Sprites / bit characters

Use small sprites for:

- Player avatar.
- Campaign guide / companion.
- Bosses.
- Review reminders.
- Loading/empty states.

Sprites should not block solving. They live in margins, headers, cards, animation scenes, and reward moments.

### Animation/replay area

This is where the pixel style can be strongest:

- arrays as doors/chests/platforms.
- linked lists as islands/portals.
- pointers as glowing paths/arrows.
- boss as a bit character reacting to reads/comparisons.

Keep it optional and inspectable.

## Page-level design specs

### Hub page

- Background: dark pixel overworld or subtle tiled grid.
- Three large navigation cards: Profile, Campaign, Questions.
- Small companion dialogue bubble: “Pick a path, then we’ll fight the bug.”
- Compact stats strip.
- Continue quest CTA.

### Campaign page

- Pixel map or quest board.
- Nodes connected by dotted/pixel paths.
- Boss node at end.
- Side panel shows campaign summary.
- Progress shown as simple hearts/stars/bars, not huge charts.

### Questions list

- Compact quest rows/cards.
- Status badge per question.
- One primary action: Start / Continue / Review / Boss.
- Keep the list much quieter than current front page.

### Question page

- NeetCode-like split screen.
- Pixel chrome around panes.
- Left pane: question tabs.
- Right pane: editor/compiler.
- Result drawer below editor.
- Animation hidden behind tab until requested.

## Copy tone

Short, game-like, and encouraging.

Good:

- “Quest unlocked.”
- “Boss gate is open.”
- “Try one more trace.”
- “Your pointer wandered off the map.”
- “Clean clear. +40 XP.”

Avoid:

- Corporate dashboard copy.
- Long motivational paragraphs.
- Ominous horror lines.
- Shamey failure language.

## Acceptance criteria

- UI clearly follows a Profile → Campaign → Questions → Question solve flow.
- First screen is calm and does not expose every system.
- Question page is split-pane: problem left, code right.
- Compiler/code area takes roughly half the screen.
- Animation/replay is optional.
- Retro pixel style is visible but does not harm readability.
- Overall mood reads as “Undertale-like, but happier.”
- Color scheme uses dark RPG base with cyan/teal/gold/pink accents.
- Problem text and code remain readable and professional.
