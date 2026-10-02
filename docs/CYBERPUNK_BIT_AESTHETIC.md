# Quest Coder Cyberpunk Bit Aesthetic

## Summary

The revised Quest Coder visual direction is **Cyberpunk Bit**: a retro maze-terminal coding game that sits between **Pac-Man** and **Undertale**.

The product should keep the bit/pixel format, but move away from the previous fantasy direction. The new design should feel like:

- Pac-Man's readable arcade maze language: black field, neon maze lanes, pellets, power nodes, ghost/chaser pressure, score clarity.
- Undertale's encounter language: black/dark dialogue panels, stark borders, expressive text, compact choices, simple battle framing, character personality.
- Quest Coder's coding focus: professional split-pane solve screen, readable code editor, problem text on the left, code/compiler on the right.

This is not a Pac-Man clone and not an Undertale clone. It is an original coding RPG interface that borrows broad design principles: maze rhythm, neon contrast, encounter framing, small character flavor, and clear choice architecture.

## Source Study

### Pac-Man design principles to adapt

Sources reviewed:

- MoMA collection entry for Toru Iwatani's *Pac-Man* notes that Pac-Man is an early interactive flat landscape/maze game, created as a nonviolent arcade game with a giant yellow circle protagonist, colorful ghosts chosen for cuteness over scariness, dot-eating maze progression, and power pellets that let the player temporarily attack ghosts.
- Official Pac-Man manual material describes a short/simple rule set: clear mazes by eating pellets, avoid ghosts, use power pellets, fruit bonuses, warp tunnels, score/lives, and escalating maze pace.

Adaptable design lessons:

- **Maze-first spatial clarity:** paths should be obvious at a glance. Use grid/maze lanes for campaign paths, quest progress, and dependency chains.
- **Pellet rhythm:** many tiny progress markers can show learning steps, reviewed concepts, or test cases cleared.
- **Power node / power pellet metaphor:** special nodes can represent hints, review boosts, boss unlocks, or successful test streaks.
- **Ghost pressure without horror:** bugs, failing tests, review reminders, and boss gates can feel like chasers or patrols, but cute/arcade rather than scary.
- **Score readability:** XP, shards, streak, review count, run status, and test result should be glanceable and numeric.
- **Black + neon contrast:** dark field, electric blue maze strokes, yellow player accent, magenta/cyan/green enemies or statuses.
- **Loop simplicity:** choose path → enter encounter → solve → clear pellets/tests → unlock next route.

Do not copy:

- Pac-Man character shape, ghosts, maze layout, sound effects, fruit iconography, exact colors, exact UI, or level structure.

### Undertale design principles to adapt

Sources reviewed:

- Undertale reference/wiki material describes turn-based encounters where the player chooses options such as FIGHT, ACT, ITEM, and MERCY, while enemy turns use a red SOUL/heart bullet-dodging space. It emphasizes mood/dialogue, compact battle choices, and player action affecting outcomes.
- Screenshot/reference databases show Undertale's strong battle-screen pattern: dark background, high-contrast white boxes, simple typography, compact menus, expressive character dialogue, and small sprite/story moments rather than visually dense UI.

Adaptable design lessons:

- **Encounter framing:** selected questions become focused encounters, not dashboard pages.
- **Dialogue as teaching:** short companion lines can frame the learning moment or explain a failed test.
- **Choice clarity:** tabs/actions should be few and explicit: Question, Animation, Hints, Solution, Submissions; Run and Submit remain primary.
- **Dark panels + white borders:** use stark high-contrast panels for problem/console/result surfaces.
- **Minimal motion:** the visual system should use precise, optional moments rather than permanent animation.
- **Tone through copy:** short, weird, encouraging copy can make the product memorable without clutter.

Do not copy:

- Undertale characters, battle UI exactly, fonts, sprites, soul/heart icon, dialogue text, sound effects, exact menu styling, or story tone.

## North Star

**Quest Coder = cyberpunk arcade encounter console.**

The user is navigating an algorithm city-maze. Problems are encounters. Tests are pellets/data packets. Failing cases are glitch ghosts. Bosses are firewall gates. Replay/animation is the trace grid that shows how the bug moved through the maze.

## Core Product Metaphor

- **Hub** = arcade terminal / city node selector.
- **Profile** = save file + score card.
- **Campaign** = neon maze district map.
- **Questions list** = terminal job board / encounter queue.
- **Question solve screen** = Undertale-like encounter frame + professional coding IDE.
- **Animation/replay** = trace grid / packet chase visualization.
- **Hints** = power nodes.
- **Tests** = pellets / data packets.
- **Failing cases** = glitch ghosts / patrols.
- **Boss** = firewall gate.
- **Review due** = rematch signal returning through the maze.

## Palette Direction

Keep a dark readable base and move accents toward neon arcade/cyberpunk.

Recommended tokens for the implementation pass:

```css
--qc-void: #05030A;
--qc-grid: #0B1020;
--qc-panel: #101428;
--qc-panel-2: #171A33;
--qc-maze-blue: #2F7DFF;
--qc-neon-cyan: #00F5FF;
--qc-pac-yellow: #FFE14A;
--qc-ghost-pink: #FF4FD8;
--qc-ghost-red: #FF4D6D;
--qc-power-blue: #5DEBFF;
--qc-terminal-green: #36D399;
--qc-warning-orange: #FF9F1C;
--qc-text: #FFF7D6;
--qc-muted: #9CA3C7;
```

Usage:

- Maze lanes / progress path: `--qc-maze-blue`.
- Player/current quest: `--qc-pac-yellow`.
- Failing tests / bug pressure: `--qc-ghost-red` or `--qc-ghost-pink`.
- Hints / power states: `--qc-power-blue`.
- Success/clear: `--qc-terminal-green`.
- Editor/prose: `--qc-text` on dark panel; never neon body text.

## Surface Guidance

### Hub

- Should look like an arcade terminal boot screen, not a fantasy academy.
- Three main choices stay: Profile, Campaign, Questions.
- Use subtle maze-line background, terminal glow, pixel companion/avatar.
- Keep the code editor and replay theater off the Hub.

### Profile

- Reads as save file + high-score card.
- XP/shards/streak/boss clears become score-style stats.
- Review reminders can appear as rematch pings.

### Campaign

- Campaign cards become neon maze districts.
- Progress path uses pellet nodes and power nodes.
- Boss gate becomes a firewall gate.
- Every state needs a text label: locked, available, cleared, review due, boss, gate open/gate locked.

### Questions List

- Reads as a terminal job board.
- Keep filters visible and fast.
- Use small glyphs/pellets for status, not large decorative art.

### Solve Screen

- This remains the product's serious coding surface.
- Left side can use the cyberpunk encounter frame: question, mini maze path, hints, animation, solution, submissions.
- Right side stays a dark professional editor/console.
- Do not add moving neon, ghost sprites, or maze clutter near the code editor.
- Do not use pixel fonts for code or long problem paragraphs.

### Animation / Replay

- Best place for the arcade/cyberpunk style.
- Show pointer movement or search boundaries as packet movement through a grid.
- Failing tests can show as glitch patrols, but only when the user opens Animation.
- Motion remains user-controlled: Play, Pause, Step.

## Do / Don't

Do:

- Keep the bit/pixel format.
- Use dark panels, sharp borders, neon maze paths, pellet nodes, terminal glow, and compact dialogue.
- Make the design feel arcade-like, quick, and readable.
- Keep code/problem text readable and professional.
- Use Pac-Man and Undertale as broad design references only.

Don't:

- Use the previous fantasy-cloud theme as the active direction.
- Copy Pac-Man characters/ghosts/maze layouts or Undertale characters/UI/fonts/dialogue.
- Turn the solve screen into a noisy arcade cabinet.
- Use neon text for long paragraphs.
- Rely on color alone for state.

## Implementation Implication

The next implementation pass should replace old fantasy-cloud classes/copy/assets with cyberpunk-bit primitives. Keep the underlying Sprint 10–15 UX flow intact: Profile/Campaign/Questions first, focused split-pane solve after selection, optional animation/replay, and dark readable editor.
