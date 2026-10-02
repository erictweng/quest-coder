#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const css = readFileSync(`${root}/app/globals.css`, "utf8");
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const plan = readFileSync(`${root}/docs/CYBERPUNK_BIT_MILESTONE_PLAN.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

milestone("Cyberpunk milestone 2 plan exists", () => {
  for (const token of ["Milestone 2 — Cyberpunk Token Layer", "--qc-maze-blue", ".cyber-bit-world", ".firewall-gate"]) {
    assert(plan.includes(token), `plan missing ${token}`);
  }
});

milestone("Cyberpunk tokens exist", () => {
  for (const token of ["--qc-grid", "--qc-maze-blue", "--qc-neon-cyan", "--qc-pac-yellow", "--qc-ghost-pink", "--qc-ghost-red", "--qc-power-blue", "--qc-terminal-green", "--qc-warning-orange"]) {
    assert(css.includes(token), `CSS token missing ${token}`);
  }
});

milestone("Cyberpunk primitives exist", () => {
  for (const token of [".cyber-bit-world", ".maze-grid-field", ".neon-maze-panel", ".terminal-card", ".pellet-node", ".power-node", ".firewall-gate"]) {
    assert(css.includes(token), `CSS primitive missing ${token}`);
  }
});

milestone("Active shell uses cyberpunk layer", () => {
  assert(page.includes("cyber-bit-world maze-grid-field pixel-console"), "main shell should use cyberpunk world/grid classes");
  assert(!page.includes("<main className=\"sky-island-world"), "main shell should not use old sky class");
  assert(page.includes("Quest Coder · Sprint 15.6 Cyberpunk Bit"), "header should use Cyberpunk Bit title");
  assert(page.includes("Cyberpunk Bit terminal"), "intro copy should use Cyberpunk Bit direction");
});

milestone("Existing accessibility/readability rules remain", () => {
  for (const token of ["prefers-reduced-motion", "ui-monospace", "focus-visible", "solve-split"]) {
    assert(css.includes(token) || page.includes(token), `accessibility/readability token missing ${token}`);
  }
});
