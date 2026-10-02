#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const plan = readFileSync(`${root}/docs/CYBERPUNK_BIT_MILESTONE_PLAN.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

const hubIndex = page.indexOf('surface === "hub" ? (');
const profileIndex = page.indexOf('surface === "profile" ? (');
const hubBranch = page.slice(hubIndex, profileIndex);

milestone("Cyberpunk milestone 3 plan exists", () => {
  for (const token of ["Milestone 3 — Hub Arcade Terminal", "arcade terminal", "Profile / Campaign / Questions", "pixel operator/avatar"]) {
    assert(plan.includes(token), `plan missing ${token}`);
  }
});

milestone("Hub uses Cyberpunk Bit terminal language", () => {
  for (const token of ["Cyberpunk Bit Hub Arcade Terminal", "Pixel operator", "Score file", "Neon districts", "Encounter board", "Continue Last Quest"]) {
    assert(hubBranch.includes(token), `hub missing ${token}`);
  }
});

milestone("Hub uses cyber primitives", () => {
  for (const token of ["terminal-card", "neon-maze-panel", "pellet-node", "power-node", "firewall-gate", "cyber-asset"]) {
    assert(hubBranch.includes(token), `hub missing cyber primitive ${token}`);
  }
});

milestone("Hub preserves UX boundaries", () => {
  for (const token of ["Profile", "Campaign", "Questions", "selectChallenge(activeChallenge.id)", "compiler when the quest starts"]) {
    assert(hubBranch.includes(token), `hub missing preserved UX token ${token}`);
  }
  assert(!hubBranch.includes("textarea"), "hub should not render code editor");
  assert(!hubBranch.includes("SceneRenderer"), "hub should not render replay theater");
});

milestone("Hub removed old fantasy asset references", () => {
  for (const token of ["/art/sky-island/", "floating-island", "quest-lantern", "sky academy", "Sky-Island Academy"]) {
    assert(!hubBranch.includes(token), `hub still contains old fantasy token ${token}`);
  }
});
