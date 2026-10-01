# Quest Coder Sky-Island Academy Milestone Plan

## Goal

Turn the current Sprint 15 pixel visual system into a more specific **Sky-Island Academy** art direction: bright floating islands, cozy cloud-world fantasy, readable coding surfaces, and original pixel UI motifs inspired by the reference mood without copying assets.

## Current State

- Sprint 15 shipped a general pixel RPG visual system.
- The next style refinement should specialize it into a brighter sky-island world.
- The solve workspace must stay clean: no large top category module, no broad dashboard chrome, no decorative clutter near code.
- Existing source plan: `.hermes/plans/2026-10-01_002157-sky-island-pixel-aesthetic.md`.

## North Star

**Quest Coder = coding academy in the clouds.**

- Hub: sky academy landing.
- Campaign: floating island map.
- Campaign detail: quest path as stepping stones / lantern nodes.
- Boss: sky gate / vault door.
- Solve: quiet study platform; left pane gets world flavor, right pane stays professional editor.
- Animation: magical trace theater, opened only when useful.

## Milestone 1 — Art Direction Lock

**Objective:** Convert the reference into a concrete original art direction.

**Deliverables:**

- `docs/SKY_ISLAND_PIXEL_AESTHETIC.md`
- Patch `docs/UI_UX_FLOW_AND_AESTHETIC.md`
- Patch `docs/UI_UX_REDESIGN_BRIEF.md`

**Acceptance:**

- Defines Sky-Island Academy mood, palette, motifs, do/don't rules.
- States no direct copying of the reference image/assets.
- Clarifies how this refines “Undertale-like, but happier.”

**Verification:**

```bash
grep -R "Sky-Island Academy" docs/SKY_ISLAND_PIXEL_AESTHETIC.md docs/UI_UX_FLOW_AND_AESTHETIC.md docs/UI_UX_REDESIGN_BRIEF.md
```

## Milestone 2 — CSS Sky-Island Token Layer

**Objective:** Add the design-system layer before changing screens.

**Deliverables:**

- Add tokens in `app/globals.css`:
  - `--qc-sky`
  - `--qc-sky-soft`
  - `--qc-cloud`
  - `--qc-grass`
  - `--qc-bark`
  - `--qc-wood`
  - `--qc-roof`
  - `--qc-blossom`
- Add primitives:
  - `.sky-island-world`
  - `.cloud-drift`
  - `.floating-island-panel`
  - `.wood-sign-panel`
  - `.sky-gate-boss`

**Acceptance:**

- Tokens exist and are used by at least one UI surface.
- Reduced-motion rules cover any animation.
- Existing Sprint 15 tokens remain intact.

**Verification:**

```bash
npm run smoke:sprint15
npm run typecheck
npm run build
```

## Milestone 3 — Hub Sky Academy Landing

**Objective:** Make the first screen feel like a bright floating academy, not a dark dashboard.

**Deliverables:**

- Update Hub in `app/page.tsx`.
- Use sky/island/wood-sign motifs for the three cards:
  - Profile
  - Campaign
  - Questions
- Add companion sprite placeholder as original bit-character guide.

**Acceptance:**

- Hub remains low-noise.
- No editor/replay on Hub.
- User still sees the three major choices immediately.
- Text contrast is readable.

**Verification:**

```bash
npm run smoke:sprint10
npm run smoke:sprint11
npm run smoke:sprint15
npm run typecheck
```

**Screenshot:**

- `docs/sky-island-verification-hub.png`

## Milestone 4 — Campaign Floating Islands

**Objective:** Make campaign selection the most game-like map screen.

**Deliverables:**

- Campaign list cards become floating islands.
- Campaign detail path becomes stepping stones / lantern nodes.
- Boss node becomes a sky gate.
- Status labels stay textual:
  - locked
  - available
  - cleared
  - review due
  - boss
  - gate locked/open

**Acceptance:**

- Campaign page reads as pixel adventure progression.
- Boss gate status is visible.
- No state depends on color alone.
- The screen remains scannable.

**Verification:**

```bash
npm run smoke:sprint12
npm run smoke:sprint15
npm run typecheck
```

**Screenshots:**

- `docs/sky-island-verification-campaigns.png`
- `docs/sky-island-verification-campaign-detail.png`

## Milestone 5 — Solve Screen Restraint Pass

**Objective:** Add the new art direction to solve mode without bringing back workspace noise.

**Deliverables:**

- Compact left-pane quest path styled as mini stepping stones.
- Question pane can use sky/wood framing.
- Right code/compiler pane stays dark and readable.
- Animation stays optional.

**Hard constraints:**

- Do not restore a large top title/category module.
- Do not add moving decorative art near the editor.
- Do not use pixel fonts for code or long problem text.

**Verification:**

```bash
npm run smoke:sprint13
npm run smoke:sprint14
npm run smoke:sprint15
npm run typecheck
```

**Screenshots:**

- `docs/sky-island-verification-solve-desktop.png`
- `docs/sky-island-verification-solve-mobile.png`

## Milestone 6 — Original Mini Asset Kit

**Objective:** Create a tiny original asset set after the CSS prototype proves the direction.

**Candidate assets:**

- `public/art/sky-island/companion.png`
- `public/art/sky-island/cloud-tile.png`
- `public/art/sky-island/floating-island.png`
- `public/art/sky-island/quest-lantern.png`
- `public/art/sky-island/boss-gate.png`
- `public/art/sky-island/reward-sparkle.png`
- `public/art/sky-island/review-rematch.png`

**Creation methods:**

- Aseprite / LibreSprite / Piskel for final sprites.
- SVG block shapes for scalable UI ornaments.
- AI concepting allowed only for mood exploration; final shipped assets must be original/redrawn.

**Acceptance:**

- Assets are original.
- Assets are small and optimized.
- Assets do not block the solve workflow.

## Milestone 7 — Sky-Island Smoke Test

**Objective:** Make the aesthetic regressible.

**Deliverables:**

- `scripts/sky-island-aesthetic-smoke.mjs`
- `package.json` script: `smoke:sky-island`

**Assertions:**

- Sky-island tokens exist.
- Hub uses sky-island primitive class.
- Campaign uses floating-island primitive class.
- Solve still includes split-pane layout.
- Editor still uses monospace/readable font.
- Reduced-motion CSS exists.

**Verification:**

```bash
npm run smoke:sky-island
```

## Milestone 8 — Final Regression + Screenshots

**Objective:** Lock the aesthetic pass before moving into final Sprint 16 QA.

**Verification gate:**

```bash
npm run test:runner
npm run typecheck
npm run build
npm run smoke:sprint10
npm run smoke:sprint11
npm run smoke:sprint12
npm run smoke:sprint13
npm run smoke:sprint14
npm run smoke:sprint15
npm run smoke:sky-island
```

If shared CSS changes are broad, also run:

```bash
npm run smoke:sprint2
npm run smoke:sprint7
npm run smoke:sprint9
```

## Suggested Sprint Framing

This should be treated as **Sprint 15.5 — Sky-Island Academy Art Direction Pass** before Sprint 16 final UI/UX regression.

Reason: Sprint 15 already established generic pixel primitives. This pass specializes the aesthetic and should be verified before final regression.

## Open Questions

1. Should the sky-island style take over all screens, or only Hub/Campaign while solve stays mostly dark?
2. Should we ship CSS-only first, or create the mini asset kit in the same sprint?
3. Should the companion sprite be named now or remain generic until later?
4. Should screenshots be committed, or kept local as verification artifacts only?
