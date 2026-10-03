# Medieval Pixel MMO Redesign — Implementation Plan

> Each milestone is its own PR with desktop and mobile screenshots, and stops for review before the next one starts. Status: **M0 (style tile) in review.**

**Goal:** Reskin Quest Coder as a medieval, pixel-art MMO RPG (town hub, world map, quest board, character sheet, action-bar HUD, loot and level-up moments) without making reading problems or writing code harder.

**Architecture:** First split the 1,051-line `app/page.tsx` into components with no visual change. Then replace the Cyberpunk Bit token layer with a medieval token layer and a small set of pixel primitives (panel, button, bar, tooltip, toast, portrait frame). Then reskin screen by screen. Game logic, the API, the runner, auth and progress are untouched.

**Tech stack:** Next.js 16 App Router, Tailwind, CSS custom properties, original pixel SVG/PNG assets in `public/art/medieval/`, `next/font/google` for OFL pixel fonts, Playwright (+ axe) for behavior, accessibility and screenshots.

---

## 1. Direction

**Mood:** a warm, friendly fantasy MMO, not grim. Think "Saturday morning in a pixel kingdom": stone and oak UI frames, parchment for reading, gold accents, gem-coloured rarity.

**Current state (verified):** the `--qc-*` tokens in `app/globals.css` are Cyberpunk Bit (neon cyan, Pac yellow, ghost pink). Body font is Arial; no pixel font is loaded. Art: `public/art/cyberpunk-bit/*.svg` and older `public/art/sky-island/*.svg`. All UI lives in `app/page.tsx` (+ `components/completion-moment.tsx`, `components/result-summary.tsx`).

**This replaces Cyberpunk Bit** as the visual direction. The UX rules stay: Profile → Campaign → Quest list on the hub; the solve screen is compiler-first with the bottom-right notebook; replay is optional.

### Screen metaphors (MMO framing for existing features only)

| Today | Medieval MMO | Notes |
|---|---|---|
| Profile / stats | **Character sheet**: portrait, name, level, XP bar, shards as gold, cleared-quest count | Data unchanged; level derived from XP client-side for display only |
| Campaign | **World map**: regions as pixel landmarks (Forest of Patience = first region), path between nodes, locked regions fogged | One region exists today; others show as "Coming soon" fog |
| Questions list | **Quest board / quest log**: parchment notices with difficulty pips and reward preview | |
| Boss | **Boss encounter card** with a nameplate and gate | Same unlock rule |
| Solve screen top bar | **HUD**: small portrait + level + XP bar, Home ("Return to town") | Stays one thin bar |
| Run / Submit | **Action bar**: two large slots "Run" and "Submit", with keyboard hints | Keep the plain words; flavour goes in tooltips only |
| Result drawer / console | **Combat log** styling: per-case lines with ✔/✖ icons + text | Status never colour-only |
| Quest Notebook | **Quest journal** (book with tabs: Quest, Path, Hints, Replay, Solution, Attempts) | Same pop-out behaviour |
| Reward toast | **Loot toast** + **Level up!** banner | Brief, respects reduced motion |
| Sign-in | "Enter the realm" panel with the Google button | Google's button rules: keep logo + "Sign in with Google" text |

**Out of scope (MMO feel, not MMO features):** chat, guilds, parties, trading, other players on screen. Leaderboards could come later; the server runner now makes clears trustworthy enough for that.

### Readability boundaries (non-negotiable)

- Code editor: monospace, dark, no pixel font, no textures behind code.
- Problem statement and hints: readable body font, 16px+, ≥1.5 line height, dark ink on parchment or light text on stone at ≥4.5:1 contrast.
- Pixel fonts only for headings, labels, badges, numbers, and one-line dialogue; minimum 16px rendered.
- Every status (pass, fail, locked, cleared) has an icon or text, not just colour.
- Visible focus ring on everything (2px gold + dark outline).
- `prefers-reduced-motion`: no idle sprite animation, toasts fade instead of bounce.
- No horizontal scroll at 1280px or 390px widths.

## 2. Design tokens (target)

```
--qc-ink        #1B1410   text on parchment
--qc-parchment  #F3E3C0   reading surfaces
--qc-parchment-2#E6D0A0
--qc-stone      #2B2A33   frames and dark panels
--qc-stone-2    #3C3A47
--qc-iron       #8A8F9C   borders and dividers
--qc-oak        #6B4426   wooden frames
--qc-gold       #F2C14E   accents, focus ring, XP
--qc-text       #F7EFDD   text on stone
--qc-text-muted #C9BFA8
--qc-emerald    #3FBF6A   pass / uncommon
--qc-sapphire   #4A8FE0   rare / links
--qc-amethyst   #A066D8   epic
--qc-ruby       #E0525A   fail / boss
--qc-ember      #F08A3C   warnings
```

Every text/background pair is checked for ≥4.5:1 in M1 (script below), and the table is adjusted if a pair fails.

**Fonts (licenses verified in M1 before use):** Pixelify Sans for all UI text and the system monospace font for code. All loaded with `next/font/google`, so they're self-hosted with no runtime calls to Google.

**Pixel rendering:** 9-slice frames via `border-image` from small PNG/SVG sources at integer scale, `image-rendering: pixelated`, hard stepped shadows (`box-shadow` with zero blur), buttons press 2px down/right.

## 3. Milestones

Each milestone: a branch and PR, lint + unit + build + `test:e2e` + `test:e2e:accessibility` + mobile smoke green, desktop (1440×900) and mobile (390×844) screenshots attached, then a stop for review.

### M0 — Style tile for approval (no app changes)
- Create `app/styleguide/page.tsx` (blocked in production with `notFound()` unless `NODE_ENV !== "production"`), showing palette, fonts, panel/button/bar/toast primitives, one quest card, one combat-log line, the HUD bar.
- Deliverable: screenshots for Eric to approve or redirect *before* any screen is reskinned.
- Test: e2e asserts `/styleguide` returns 404 on the production build.

### M1 — Tokens, fonts, primitives
- Modify `app/globals.css`: replace the `--qc-*` palette with the tokens above; keep the old names as aliases until M5 so nothing breaks mid-way.
- Modify `app/layout.tsx`: load fonts via `next/font/google`, expose them as CSS variables.
- Create `components/ui/pixel.tsx`: `PixelPanel` (variants: stone, parchment, oak), `PixelButton` (primary/secondary, pressed state, focus ring), `StatBar` (XP/progress with text value), `PixelTooltip`, `LootToast`, `PortraitFrame`.
- Create `scripts/contrast_check.mjs` + `npm run test:contrast`: parses token pairs from `globals.css` and fails under 4.5:1 (3:1 for large headings).
- Test: unit test for the contrast parser; axe stays green.

### M2 — Split `app/page.tsx` (no visual change)
- Extract into `components/hub/*` (Profile, Campaign, QuestList), `components/solve/*` (TopBar, Editor, ResultDrawer, Notebook + tabs), `components/replay/*` (scene renderers).
- Pure move; `page.tsx` keeps state and wiring.
- Test: full e2e (14), smoke, axe all green with zero assertion changes. This is the safety net for M3–M5.

### M3 — Town hub
- Character sheet, world map (Forest of Patience node + fogged future regions), quest board.
- Original art in `public/art/medieval/`: portrait frame, forest landmark, boss gate, fog tile, quest notice, gold coin, XP gem.
- Test: e2e hub assertions updated by role/name only (not CSS); add "locked quest shows a lock icon and the text Locked".

### M4 — Solve screen
- HUD top bar, action bar (Run, Submit, with Ctrl+Enter / Ctrl+Shift+Enter hints if those shortcuts exist; otherwise only the labels), combat-log result drawer, quest journal notebook.
- Editor surface untouched except the frame around it.
- Test: existing solve journey e2e; add a check that the editor's computed `font-family` is monospace and its background has no image.

### M5 — Moments + cleanup
- Loot toast, level-up banner, boss encounter intro, campaign-complete scene; replay scenes re-skinned (Fibonacci/stairs scene as a castle staircase).
- Remove Cyberpunk Bit and Sky Island assets and alias tokens; grep test that no `pac-`/`ghost-`/`neon-` tokens remain in active source.
- Test: reduced-motion e2e (emulate `reducedMotion: "reduce"`, assert no running CSS animations on the hub).

### M6 — Release pass
- Cross-browser smoke (Chromium/Firefox/WebKit/mobile), axe, contrast, Lighthouse performance spot-check (fonts and art must not regress LCP noticeably), release-evidence workflow, screenshots of every screen.

## 4. Risks and trade-offs

- **Art quality is the biggest risk.** Hand-written pixel SVGs look clean but simple. Options: (a) original simple pixel art made in code (free, consistent, modest); (b) a CC0 pack such as Kenney's (better quality, credit optional, licence must be re-checked per pack); (c) commissioned art later. The token/primitive layer works for all three, so art can be upgraded without rework.
- **Pixel fonts hurt readability** if overused; the boundaries above limit them to short text.
- **Page size:** fonts + sprites add weight; keep total art under ~150 KB and use `next/font` subsetting.
- **Medieval clichés vs. friendliness:** keep the palette warm and copy encouraging ("Quest complete! +40 XP"), no skulls/gore.
- **Scope creep into real MMO features** (chat, guilds): explicitly out of scope for this redesign.

## 5. Decisions (Eric, 2026-10-02)

1. **Art:** original code-drawn pixel art now (`components/medieval/sprites.tsx`), swapped for drawn sprites later at the same sizes.
2. **Look:** dark stone and oak frames, parchment for reading.
3. **Font:** one pixel font everywhere: **Pixelify Sans** (OFL, self-hosted via `next/font`). Code stays monospace. The style tile shows a problem paragraph in both Pixelify Sans and a plain font so the problem-text choice can be confirmed.
4. **M0 first:** the style tile at `/styleguide` (local dev and Vercel previews only; 404 on production).
