#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const css = readFileSync(`${root}/app/globals.css`, "utf8");
const artDoc = readFileSync(`${root}/docs/SKY_ISLAND_PIXEL_AESTHETIC.md`, "utf8");
const milestoneDoc = readFileSync(`${root}/docs/SKY_ISLAND_MILESTONE_PLAN.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

milestone("Sky-Island art direction docs exist", () => {
  for (const token of ["Sky-Island Academy", "floating islands", "sky gate", "Do not copy", "quiet study platform"]) {
    assert(artDoc.includes(token) || milestoneDoc.includes(token), `Sky-Island docs missing ${token}`);
  }
});

milestone("Sky-Island CSS tokens exist", () => {
  for (const token of ["--qc-sky", "--qc-sky-soft", "--qc-cloud", "--qc-grass", "--qc-bark", "--qc-wood", "--qc-roof", "--qc-blossom"]) {
    assert(css.includes(token), `CSS sky token missing ${token}`);
  }
});

milestone("Sky-Island primitives exist and are used", () => {
  for (const token of ["sky-island-world", "cloud-drift", "floating-island-panel", "wood-sign-panel", "sky-gate-boss", "quest-stepping-stone"]) {
    assert(css.includes(`.${token}`), `CSS primitive missing ${token}`);
    assert(page.includes(token), `App does not use ${token}`);
  }
});

milestone("Hub reads as Sky-Island Academy", () => {
  for (const token of ["Sky-Island Academy", "Choose your sky path", "Sky academy companion", "Floating islands", "Notice board"]) {
    assert(page.includes(token), `Hub copy/class missing ${token}`);
  }
});

milestone("Campaign uses floating islands and sky gates", () => {
  for (const token of ["Floating island", "Island route", "Lantern node", "Sky gate", "sky gate open", "sky gate locked"]) {
    assert(page.includes(token), `Campaign sky-island token missing ${token}`);
  }
});

milestone("Solve keeps workspace restraint", () => {
  assert(page.includes("quiet sky study platform"), "solve compact header copy missing");
  assert(page.includes("Study island pane"), "left solve pane flavor missing");
  assert(page.includes("Lantern path"), "mini quest path flavor missing");
  assert(page.includes("Dark terminal preserved for readability"), "editor readability boundary missing");
  assert(!page.includes("Timequake: Search the Rotated Vault</h1>"), "large top campaign title should not return");
});

milestone("Accessibility constraints remain intact", () => {
  for (const token of ["prefers-reduced-motion", ":focus-visible", "ui-monospace", "status-label::before", "solve-split"]) {
    assert(css.includes(token), `accessibility CSS missing ${token}`);
  }
});
