# Quest Coder Cyberpunk Bit Milestone Plan

## Goal

Replace the rejected fantasy-cloud direction with **Cyberpunk Bit**: a dark neon arcade-coding aesthetic that sits between Pac-Man's maze clarity and Undertale's encounter/dialogue framing, while preserving Quest Coder's split-pane coding workflow.

## Current State

- Product UX flow is still correct: Profile / Campaign / Questions, then focused split-pane solve.
- Current implementation still contains older fantasy-cloud copy/classes/assets from the previous aesthetic pass.
- This plan is the active design roadmap before Sprint 16 final UI/UX QA.
- Code editor readability remains non-negotiable.

## North Star

**Quest Coder = cyberpunk arcade encounter console.**

- Hub: arcade terminal node selector.
- Profile: save file / high-score card.
- Campaign: neon maze district map.
- Campaign detail: pellet route / power-node path.
- Boss: firewall gate.
- Solve: Undertale-like encounter frame + professional IDE.
- Animation: trace-grid packet chase, opened only when useful.

## Milestone 1 — Art Direction Rewrite

**Objective:** Replace the previous fantasy-cloud documentation with the Cyberpunk Bit doctrine.

**Deliverables:**

- Create `docs/CYBERPUNK_BIT_AESTHETIC.md`.
- Patch `docs/UI_UX_FLOW_AND_AESTHETIC.md`.
- Patch `docs/UI_UX_REDESIGN_BRIEF.md`.
- Remove obsolete fantasy-cloud markdown docs from the active repo docs.

**Acceptance:**

- Documents define the midpoint between Pac-Man and Undertale.
- Documents explicitly say what to adapt vs what not to copy.
- Documents remove the previous fantasy-cloud theme as the active design direction.
- Docs preserve the existing product UX flow.

**Verification:**

```bash
grep -R "Cyberpunk Bit" docs/CYBERPUNK_BIT_AESTHETIC.md docs/UI_UX_FLOW_AND_AESTHETIC.md docs/UI_UX_REDESIGN_BRIEF.md
```

## Milestone 2 — Cyberpunk Token Layer

**Objective:** Replace old fantasy-cloud tokens with neon arcade tokens.

**Deliverables:**

- Patch `app/globals.css`.
- Add/standardize tokens:
  - `--qc-grid`
  - `--qc-maze-blue`
  - `--qc-neon-cyan`
  - `--qc-pac-yellow`
  - `--qc-ghost-pink`
  - `--qc-ghost-red`
  - `--qc-power-blue`
  - `--qc-terminal-green`
  - `--qc-warning-orange`
- Add primitives:
  - `.cyber-bit-world`
  - `.maze-grid-field`
  - `.neon-maze-panel`
  - `.terminal-card`
  - `.pellet-node`
  - `.power-node`
  - `.firewall-gate`

**Acceptance:**

- Cyberpunk token layer exists.
- Old fantasy-cloud token layer is no longer the active visual layer.
- Reduced-motion rules still cover any glow/motion.
- Existing Sprint 15 pixel/accessibility primitives remain usable.

**Verification:**

```bash
npm run smoke:sprint15
npm run typecheck
npm run build
```

## Milestone 3 — Hub Arcade Terminal

**Objective:** Replace the old landing with arcade terminal / city-node selector.

**Deliverables:**

- Patch Hub in `app/page.tsx`.
- Replace old fantasy copy with Cyberpunk Bit copy.
- Profile / Campaign / Questions become terminal cards.
- Companion becomes pixel operator/avatar.

**Acceptance:**

- Hub still has only Profile / Campaign / Questions + Continue Last Quest.
- No editor/replay on Hub.
- It reads as dark neon arcade terminal within 3 seconds.
- Text contrast remains readable.

**Verification:**

```bash
npm run smoke:sprint10
npm run smoke:sprint11
npm run smoke:sprint15
npm run typecheck
```

**Screenshot:**

- `docs/cyberpunk-bit-hub.png`

## Milestone 4 — Campaign Neon Maze

**Objective:** Convert campaign selection from fantasy regions to maze districts.

**Deliverables:**

- Campaign list cards become neon districts.
- Campaign detail path becomes pellet/power-node route.
- Boss node becomes firewall gate.
- Review due becomes rematch ping.

**Acceptance:**

- Campaign page reads as arcade maze progression.
- Status labels remain textual and not color-only.
- Boss/firewall status is visible.
- Screen remains scannable.

**Verification:**

```bash
npm run smoke:sprint12
npm run smoke:sprint15
npm run typecheck
```

**Screenshots:**

- `docs/cyberpunk-bit-campaigns.png`
- `docs/cyberpunk-bit-campaign-detail.png`

## Milestone 5 — Solve Encounter Restraint Pass

**Objective:** Move solve mode into the cyberpunk encounter frame without hurting coding focus.

**Deliverables:**

- Left pane uses compact maze route / pellet node path.
- Question panel uses dark neon terminal framing.
- Right editor stays dark, professional, and free of decorative sprites.
- Animation remains optional.

**Hard constraints:**

- Do not restore a large top title/category module.
- Do not add moving neon or ghost art near the editor.
- Do not use pixel fonts for code or long problem text.
- Do not turn the workspace into a full arcade cabinet.

**Verification:**

```bash
npm run smoke:sprint13
npm run smoke:sprint14
npm run smoke:sprint15
npm run typecheck
```

**Screenshots:**

- `docs/cyberpunk-bit-solve-desktop.png`
- `docs/cyberpunk-bit-solve-mobile.png`

## Milestone 6 — Cyberpunk Mini Asset Kit

**Objective:** Replace old fantasy-cloud assets with original cyberpunk arcade assets.

**Candidate assets:**

- `public/art/cyberpunk-bit/operator.svg`
- `public/art/cyberpunk-bit/pellet-node.svg`
- `public/art/cyberpunk-bit/power-node.svg`
- `public/art/cyberpunk-bit/glitch-patrol.svg`
- `public/art/cyberpunk-bit/firewall-gate.svg`
- `public/art/cyberpunk-bit/reward-burst.svg`
- `public/art/cyberpunk-bit/rematch-ping.svg`

**Acceptance:**

- Assets are original.
- Assets use broad arcade/cyberpunk motifs without copying Pac-Man or Undertale.
- Assets stay out of the editor pane.
- Old fantasy-cloud art references are removed from active code/docs.

## Milestone 7 — Cyberpunk Smoke Test

**Objective:** Make the new aesthetic regressible.

**Deliverables:**

- `scripts/cyberpunk-bit-smoke.mjs`
- `package.json` script: `smoke:cyberpunk-bit`

**Assertions:**

- Cyberpunk tokens exist.
- Hub uses cyberpunk primitive class.
- Campaign uses maze/district primitive class.
- Solve still includes split-pane layout.
- Editor still uses readable monospace font.
- Old fantasy-cloud strings are removed from active source/docs except intentionally retained historical artifacts.

**Verification:**

```bash
npm run smoke:cyberpunk-bit
```

## Milestone 8 — Final Cyberpunk Regression + Screenshots

**Objective:** Lock the new Cyberpunk Bit direction before Sprint 16 final UI/UX QA.

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
npm run smoke:cyberpunk-bit
```

If shared CSS changes are broad, also run:

```bash
npm run smoke:sprint2
npm run smoke:sprint7
npm run smoke:sprint9
```

## Suggested Sprint Framing

Treat this as **Sprint 15.6 — Cyberpunk Bit Redirection Pass** before Sprint 16 final UI/UX regression.

Reason: the previous direction was a complete aesthetic branch. Cyberpunk Bit is a new direction and should be documented, implemented, tested, and screenshotted as its own pass.

## Open Questions for Eric

1. Should the Cyberpunk Bit pass fully replace the current UI immediately, or first land as docs/planning and then implementation?
2. Should the mini asset kit lean more Pac-Man maze/pellet or more Undertale encounter/dialogue?
3. Should the companion/operator have a name now, or stay generic until implementation review?
