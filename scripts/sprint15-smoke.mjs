#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const css = readFileSync(`${root}/app/globals.css`, "utf8");
const sprintPlan = readFileSync(`${root}/docs/UI_UX_SPRINT_PLAN.md`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_15_SMOKE_TESTS.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

milestone("Sprint 15 roadmap is wired", () => {
  for (const token of ["Sprint 15 — Pixel RPG visual system and accessibility pass", "Undertale-like, but happier", "Keyboard focus is visible"]) {
    assert(sprintPlan.includes(token) || sprintDoc.includes(token), `Sprint 15 docs missing ${token}`);
  }
  assert(sprintDoc.includes("npm run smoke:sprint15"), "Sprint 15 smoke doc missing command");
});

milestone("Visual tokens exist", () => {
  for (const token of ["--qc-void", "--qc-night", "--qc-panel", "--qc-panel-2", "--qc-border", "--qc-border-muted", "--qc-text", "--qc-text-muted", "--qc-cyan", "--qc-teal", "--qc-gold", "--qc-pink", "--qc-red", "--qc-green", "--qc-purple"]) {
    assert(css.includes(token), `CSS token missing ${token}`);
  }
});

milestone("Pixel primitives are applied", () => {
  for (const token of ["pixel-console", "pixel-panel", "pixel-dialogue", "pixel-button", "bit-sprite"]) {
    assert(css.includes(`.${token}`), `CSS primitive missing ${token}`);
    assert(page.includes(token), `App does not use ${token}`);
  }
});

milestone("Accessibility focus and motion rules exist", () => {
  for (const token of [":focus-visible", "outline", "prefers-reduced-motion", "solve-split", "max-width: 820px"]) {
    assert(css.includes(token), `accessibility/mobile token missing ${token}`);
  }
  assert(page.includes("Reduced motion safe"), "solve screen reduced-motion copy missing");
});

milestone("Code and problem text remain readable", () => {
  assert(css.includes("ui-monospace") && css.includes("textarea"), "code editor monospace rule missing");
  assert(!css.toLowerCase().includes("press start") || !page.includes("textarea"), "pixel font must not be applied to code editor");
  assert(page.includes("text-base leading-7"), "problem body readability class missing");
});

milestone("Status states are not color-only", () => {
  assert(css.includes(".status-label::before"), "status label icon/text affordance missing");
  for (const token of ["locked", "available", "cleared", "review due", "boss", "gate locked", "gate open"]) {
    assert(page.includes(token), `status text missing ${token}`);
  }
});
