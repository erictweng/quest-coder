# Sky-Island Academy Mini Asset Kit

## Purpose

This milestone adds a tiny, original, CSS-friendly asset kit for the Sky-Island Academy direction. The assets are decorative support for the Hub, Campaign, Campaign Detail, and Solve left pane. They must not compete with the code editor or problem-reading flow.

## Asset Files

- `public/art/sky-island/companion.svg` — original pixel companion guide.
- `public/art/sky-island/cloud-tile.svg` — reusable cloud ornament.
- `public/art/sky-island/floating-island.svg` — campaign island motif.
- `public/art/sky-island/quest-lantern.svg` — quest node marker.
- `public/art/sky-island/boss-gate.svg` — boss gate marker.
- `public/art/sky-island/reward-sparkle.svg` — completion/reward moment marker.
- `public/art/sky-island/review-rematch.svg` — review/rematch marker.

## Originality Rule

These are original block-shape SVG assets authored for Quest Coder. They use the Sky-Island Academy palette and broad pixel-fantasy motifs, but they do not copy the reference image, characters, buildings, or layout.

## Usage Rules

- Use assets as small ornaments, not as primary content.
- Keep `image-rendering: pixelated` through the shared `.sky-asset` class.
- Keep the code editor and long problem text free of decorative movement.
- Always pair icon state with text labels such as `available`, `locked`, `cleared`, `review due`, or `gate open`.
- Respect reduced motion; assets are static unless future animation is explicitly controlled.

## Verification

Run:

```bash
npm run smoke:sky-assets
npm run smoke:sky-island
npm run typecheck
npm run build
```
