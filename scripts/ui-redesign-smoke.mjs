#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const css = readFileSync(`${root}/app/globals.css`, "utf8");
const plan = readFileSync(`${root}/docs/UI_UX_SPRINT_PLAN.md`, "utf8");
const cyberReport = readFileSync(`${root}/docs/CYBERPUNK_BIT_FINAL_REGRESSION.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

const solveStart = page.indexOf('aria-label="Focused split-pane solve screen"');
const statusPillStart = page.indexOf('function StatusPill');
const solveBranch = page.slice(solveStart, statusPillStart);
const editorStart = solveBranch.indexOf('aria-label="Code compiler pane');
const editorBranch = solveBranch.slice(editorStart);

milestone("Sprint 16 roadmap is wired", () => {
  for (const token of ["Sprint 16 — Regression", "Hub choices", "Campaign selection", "Question list selection", "Split-pane solve screen", "Optional animation tab", "Result drawer", "reward toast"]) {
    assert(plan.includes(token), `plan missing ${token}`);
  }
});

milestone("Landing IA is Profile / Campaign / Questions plus Continue", () => {
  for (const token of ["Profile", "Campaign", "Questions", "Continue Last Quest", "Cyberpunk Bit Hub Arcade Terminal"]) {
    assert(page.includes(token), `hub missing ${token}`);
  }
  assert(!page.slice(page.indexOf('surface === "hub"'), page.indexOf('surface === "profile"')).includes("Python solution editor"), "hub should not include editor");
});

milestone("Campaign and questions flow opens focused solve", () => {
  for (const token of ["surface === \"campaigns\"", "surface === \"campaignDetail\"", "surface === \"questions\"", "selectChallenge(challenge.id)", "Questions list", "Select a question to open the focused solve screen"]) {
    assert(page.includes(token), `flow missing ${token}`);
  }
});

milestone("Solve screen preserves split-pane coding workflow", () => {
  for (const token of ["Focused split-pane solve screen", "Question", "Code compiler pane", "Problem statement", "Python solution editor", "Console / result drawer", "Run ▶", "Submit"]) {
    assert(solveBranch.includes(token), `solve missing ${token}`);
  }
  assert(editorBranch.includes("font-mono"), "editor must stay monospace");
  assert(editorBranch.includes("min-h-[34rem]"), "editor height should remain substantial");
});

milestone("Optional support tabs and contextual rewards survive", () => {
  for (const token of ["Animation", "Hints", "Solution", "Submissions", "View Animation", "Reward toast", "Boss victory moment", "Attempt history"]) {
    assert(solveBranch.includes(token), `support/reward missing ${token}`);
  }
  assert(solveBranch.includes('solveTab === "Animation"'), "animation content must stay tab-gated");
});

milestone("Cyberpunk Bit visual system and readability boundaries survive", () => {
  for (const token of ["--qc-neon-cyan", ".cyber-bit-world", ".neon-maze-panel", ".terminal-card", ".pellet-node", ".firewall-gate", "font-family: ui-monospace"]) {
    assert(css.includes(token), `visual/readability token missing ${token}`);
  }
  assert(!editorBranch.includes("/art/cyberpunk-bit/"), "decorative assets should not enter editor pane");
});

milestone("Final Cyberpunk regression report exists", () => {
  for (const token of ["Runner tests passed", "TypeScript passed", "Production build passed", "Sprint 10-15 UI/UX smoke tests passed", "Final screenshots captured"]) {
    assert(cyberReport.includes(token), `final cyberpunk report missing ${token}`);
  }
});
