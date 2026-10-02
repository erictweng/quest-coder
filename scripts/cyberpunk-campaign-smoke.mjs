#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const plan = readFileSync(`${root}/docs/CYBERPUNK_BIT_MILESTONE_PLAN.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

const campaignsIndex = page.indexOf('surface === "campaigns" ? (');
const detailIndex = page.indexOf('surface === "campaignDetail" ? (');
const questionsIndex = page.indexOf('surface === "questions" ? (');
const campaignsBranch = page.slice(campaignsIndex, detailIndex);
const detailBranch = page.slice(detailIndex, questionsIndex);

milestone("Cyberpunk milestone 4 plan exists", () => {
  for (const token of ["Milestone 4 — Campaign Neon Maze", "maze districts", "pellet/power-node route", "firewall gate"]) {
    assert(plan.includes(token), `plan missing ${token}`);
  }
});

milestone("Campaign list uses neon maze districts", () => {
  for (const token of ["Neon district", "neon-maze-panel", "power-node", "firewall open", "firewall locked", "Concepts:", "openCampaign(pack.slug)"]) {
    assert(campaignsBranch.includes(token), `campaigns branch missing ${token}`);
  }
  assert(!campaignsBranch.includes("/art/sky-island/"), "campaign list should not use old fantasy image assets");
  assert(!campaignsBranch.includes("floating-island"), "campaign list should not use old floating island token");
});

milestone("Campaign detail uses pellet route and firewall gate", () => {
  for (const token of ["Neon maze route", "Cyberpunk neon maze district", "Pellet node", "Firewall gate", "terminal-card", "pellet-node", "firewall-gate", "StatusPill"]) {
    assert(detailBranch.includes(token), `campaign detail missing ${token}`);
  }
  assert(!detailBranch.includes("/art/sky-island/"), "campaign detail should not use old fantasy image assets");
  assert(!detailBranch.includes("sky-gate-boss"), "campaign detail should not use old sky gate class");
});

milestone("Campaign status remains textual and accessible", () => {
  for (const token of ["locked", "available", "cleared", "review due", "boss", "firewall locked", "firewall open"]) {
    assert(detailBranch.includes(token) || campaignsBranch.includes(token), `status missing ${token}`);
  }
});

milestone("Campaign does not open editor directly", () => {
  assert(!campaignsBranch.includes("textarea"), "campaign list should not render editor");
  assert(!detailBranch.includes("textarea"), "campaign detail should not render editor");
  assert(page.includes('setSurface("solve")'), "selecting a quest should still enter solve mode");
});
