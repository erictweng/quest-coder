# Quest Coder Sky-Island Academy Aesthetic

## Summary

**Sky-Island Academy** is the focused art direction for the Quest Coder frontend after Sprint 15. The app should feel like a bright pixel-fantasy coding academy floating in the clouds: cozy, adventurous, readable, and original.

This refines the previous **Undertale-like, but happier** target:

- Undertale-like: simple encounter structure, compact dialogue boxes, expressive pixel framing.
- Sky-Island Academy: bright sky world, floating campaign islands, lantern quest paths, warm wooden UI, cloud/grass/academy motifs.

## Reference Adaptation Rule

The attached reference is used for **mood and composition only**.

Do not copy:

- exact buildings
- exact cliffs/islands
- exact characters
- exact trees/plants
- exact UI framing
- any shipped art from the reference source

Do adapt:

- bright sky mood
- floating vertical world structure
- warm wooden/signage language
- cloud layers
- compact foreground silhouettes
- cozy adventure feel

## Core Product Metaphor

- **Hub** = sky academy landing platform.
- **Campaign** = floating island world selection.
- **Campaign detail** = stepping-stone / lantern quest path.
- **Questions list** = notice board / quest ledger.
- **Solve screen** = quiet study platform overlooking the sky.
- **Animation tab** = magical trace theater.
- **Boss** = sky gate / vault door.
- **Review** = rematch marker returning on the map/profile.

## Palette Tokens

Use these in addition to Sprint 15's base tokens:

```css
--qc-sky: #76C7FF;
--qc-sky-soft: #BDEBFF;
--qc-cloud: #F4FBFF;
--qc-grass: #62D66E;
--qc-bark: #7B4A33;
--qc-wood: #B8793E;
--qc-roof: #2E405F;
--qc-blossom: #FF9BCB;
```

Usage:

- Sky/background: `--qc-sky`, `--qc-sky-soft`, `--qc-cloud`.
- Success/cleared states: `--qc-grass`, existing `--qc-green`.
- Signs/cards: `--qc-wood`, `--qc-bark`, `--qc-gold`.
- Roof/gate/contrast: `--qc-roof`, `--qc-night`.
- Friendly accent: `--qc-blossom`, existing `--qc-pink`.

## Surface Guidance

### Hub

- Use a sky academy landing feel.
- Profile/Campaign/Questions are island/sign cards.
- Companion sprite should be small and original.
- Keep first screen calm and simple.

### Campaigns

- Campaign cards are floating islands.
- Show completion and boss status as visible labels.
- Use bright world feel here more than anywhere else.

### Campaign Detail

- Quest nodes become stepping stones or lanterns.
- Boss node becomes a sky gate.
- Locked/available/cleared/review/boss states must use text labels, not color alone.

### Solve Screen

- Keep the structure from Sprint 13/14.
- Left pane may use sky/wood framing and compact quest path.
- Right pane remains dark, high-contrast, and editor-first.
- No large decorative top banner.
- No moving scenery near the code editor.

### Animation/Replay

- The animation tab can be magical and playful.
- Motion must be user-controlled via play/step.
- Reduced-motion preference must be respected.

## Do / Don't

Do:

- Use CSS-first sky/cloud/island motifs.
- Keep all shipped assets original.
- Use readable panels over bright backgrounds.
- Keep code and long problem text in readable normal/monospace typography.
- Use visible focus states.

Don't:

- Copy the reference image.
- Use pixel fonts for code or long problem text.
- Return to dashboard clutter in solve mode.
- Rely on color alone for state.
- Animate constantly near the editor.

## Verification

A valid Sky-Island pass should prove:

- Hub reads as sky academy.
- Campaign reads as floating islands.
- Campaign detail reads as a quest path / sky gate.
- Solve remains focused and professional.
- Mobile stacks cleanly.
- Smoke tests and full gate pass.
