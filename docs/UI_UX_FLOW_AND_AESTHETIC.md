# Quest Coder UI/UX Flow and Visual System

Direction: **Cyberpunk Bit** — a dark neon pixel/bit interface that sits between **Pac-Man** maze clarity and **Undertale** encounter framing, while preserving a focused coding workflow.

This document expands `docs/UI_UX_REDESIGN_BRIEF.md` into the active flow, aesthetic, and color scheme. The detailed design doctrine lives in `docs/CYBERPUNK_BIT_AESTHETIC.md`.

## Product feeling

Quest Coder should feel like opening a retro cyberpunk arcade terminal where algorithm questions are encounters inside a neon data maze.

The vibe is:

- Retro pixel / bit-format interface.
- Cyberpunk arcade terminal, not fantasy world.
- Pac-Man-like maze readability and score clarity.
- Undertale-like focused encounter framing and short dialogue.
- Friendly, weird, and high-contrast without becoming horror.
- Focused enough for serious coding.

## Core metaphor

- **Profile** = save file / high-score card.
- **Campaign** = neon maze district map.
- **Questions list** = terminal job board / encounter queue.
- **Question solve screen** = focused encounter + code terminal.
- **Animation/replay** = trace grid / packet chase visualization.
- **Tests** = pellets / data packets.
- **Hints** = power nodes.
- **Failing cases** = glitch patrols.
- **Boss** = firewall gate.
- **XP/Shards** = score/reward burst.
- **Review due** = rematch signal returning through the maze.

## UX flow

### 1. Landing / Hub

Goal: orient the player without showing every system.

Primary choices:

1. **Profile**
   - Save file / score card.
   - XP, shards, streak, bosses defeated.
   - Recent attempts.
   - Review/rematch pings.

2. **Campaign**
   - Neon maze districts.
   - Each campaign shows topic, completion percent, boss/firewall status, and review due count.

3. **Questions**
   - Compact terminal board of available encounters.
   - Filters: available, cleared, review due, boss.

Also include:

- Continue last quest.
- Small pixel operator/companion dialogue bubble with one helpful line.

Do not include:

- Full code editor.
- Full replay theater.
- Full reward shop.
- Full stats dashboard.

### 2. Campaign screen

Goal: choose a topic district.

Layout:

- Top: campaign title, topic, progress, firewall/boss status.
- Middle: neon maze route / pellet-node path.
- Right or lower panel: campaign description and unlock rules.
- Quest nodes show locked / available / cleared / review due.
- Boss node sits at the end as a firewall gate.

Interaction:

- Click a quest node to open the focused solve screen.
- Click boss only when unlocked.
- Hover/focus shows a short question preview, not full problem text.

### 3. Questions list

Goal: scan and select a problem quickly.

Layout:

- Dense but friendly terminal list/table.
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
│ QUESTION / ENCOUNTER PANEL         │ CODE PANEL                              │
│ 45–50% width                       │ 50–55% width                            │
│                                    │                                         │
│ Tabs: Question | Animation | Hints │ Language + Run/Submit                   │
│                                    │                                         │
│ Mini maze route                    │ Code editor                             │
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
- Cyberpunk/arcade styling stays outside the code editor content.

Mobile layout:

- Tabs: Question → Code → Result → Animation.
- Sticky Run/Submit action bar.
- Keep problem text and code in separate views to avoid cramped layout.

### 5. Result / reward moment

After run:

- Failed run: console drawer opens with short message and failing case.
- Passed quest: small score/reward burst.
- Passed boss: firewall clear moment, but short.
- Unlock next node with a small pellet/power-node animation.

Rewards should be visible, not noisy.

## Aesthetic: Cyberpunk Bit

Borrow from Pac-Man:

- Black field and neon maze readability.
- Pellet/progress-node rhythm.
- Power-node moments for special states.
- Cute pressure from chasers/patrols without horror.
- Score/lives/status readability.
- Fast arcade clarity.

Borrow from Undertale:

- Dark encounter framing.
- Strong bordered dialogue panels.
- Character-driven flavor text.
- Few clear choices.
- Optional battle/animation space.
- Minimal UI that makes each decision obvious.

Make it Quest Coder by adding:

- A real coding workspace.
- Professional code editor and console.
- Algorithm/data-structure language.
- Replay traces as learning tools.
- Status labels that are readable without color.

Avoid:

- Copying Pac-Man or Undertale assets, fonts, characters, exact UI, exact colors, sound effects, or layouts.
- Fantasy sky/cloud/island/wood-sign motifs as the active direction.
- Horror tone.
- Heavy scanlines that hurt readability.
- Neon body text for long paragraphs.
- Too many flashing effects.

## Color scheme

### Base

- `void`: `#05030A` — app background.
- `grid`: `#0B1020` — maze/grid field.
- `panel`: `#101428` — primary dark panel.
- `panel-2`: `#171A33` — secondary dark panel.
- `text`: `#FFF7D6` — warm readable text.
- `muted`: `#9CA3C7` — secondary text.

### Neon accents

- `maze-blue`: `#2F7DFF` — maze lanes / routes.
- `neon-cyan`: `#00F5FF` — active/focus states.
- `pac-yellow`: `#FFE14A` — current quest / player marker / rewards.
- `ghost-pink`: `#FF4FD8` — glitch patrol/review accent.
- `ghost-red`: `#FF4D6D` — danger/failing cases.
- `power-blue`: `#5DEBFF` — hints/power nodes.
- `terminal-green`: `#36D399` — success/cleared.
- `warning-orange`: `#FF9F1C` — warnings/boss readiness.

## Component language

### Panels

- Dark fills.
- Crisp 1–2px borders.
- Subtle neon edge glow.
- Pixel-like corners or stepped dividers.
- High contrast between panel and text.

### Buttons

- Look like arcade cabinet / terminal choices.
- Clear hover, pressed, and focus-visible states.
- Use labels, not just icons.

### Quest nodes

- Normal quest = pellet node.
- Hint/review = power node.
- Boss = firewall gate.
- Cleared = terminal-green status.
- Locked = muted status plus label.

### Companion / operator

- Small pixel operator.
- Short copy only.
- Should help orient the user, not become a mascot distraction.

### Editor

- Monospace readable font.
- No pixel font in code.
- No decorative ghost/maze animation in the editor pane.
- Run/Submit/status must stay obvious.

## Accessibility rules

- Status cannot rely on color alone.
- Problem text and code stay high-contrast and non-pixel-font.
- Motion must respect reduced-motion preferences.
- Replay movement must be controlled by Play/Pause/Step.
- Neon glow should never reduce text clarity.
- Keyboard focus states must remain visible.

## Success criteria

The redesign is successful if:

- The first screen still shows Profile / Campaign / Questions clearly.
- Campaign reads as neon arcade maze progression.
- Solve screen remains split-pane and serious.
- The code editor still feels professional.
- The aesthetic reads as between Pac-Man and Undertale without copying either.
- Old fantasy-cloud language is removed from active documentation.
