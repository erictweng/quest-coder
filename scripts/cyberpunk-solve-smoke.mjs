#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const plan = readFileSync(`${root}/docs/CYBERPUNK_BIT_MILESTONE_PLAN.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

const solveIndex = page.indexOf('one-question-workspace');
const postSolveIndex = page.indexOf('function StatusPill');
const solveBranch = page.slice(solveIndex, postSolveIndex);
const editorStart = solveBranch.indexOf('aria-label="Code compiler pane');
const notebookStart = solveBranch.indexOf('quest-notebook-toggle');
const editorBranch = solveBranch.slice(editorStart, notebookStart);

milestone("Cyberpunk milestone 5 plan exists", () => {
  for (const token of ["Milestone 5 — Solve Encounter Restraint Pass", "solve mode", "Left pane", "Right editor", "free of decorative sprites"]) {
    assert(plan.includes(token), `plan missing ${token}`);
  }
});

milestone("Solve screen uses Cyberpunk encounter frame", () => {
  for (const token of ["Full-screen compiler workspace", "one-question-workspace", "Quest Notebook", "terminal-card", "neon-maze-panel", "pellet-node", "Mini quest path"]) {
    assert(solveBranch.includes(token), `solve branch missing ${token}`);
  }
});

milestone("Editor remains clean and readable", () => {
  for (const token of ["Code compiler pane - restrained no decorative clutter near editor", "full-screen focus", "font-mono", "solution.py", "bg-slate-950/95", "font-feature-settings"]) {
    assert(editorBranch.includes(token), `editor branch missing ${token}`);
  }
  for (const forbidden of ["sky-asset", "/art/sky-island/", "SceneRenderer replay={replay}"]) {
    assert(!editorBranch.includes(forbidden), `editor branch contains forbidden decorative token ${forbidden}`);
  }
});

milestone("Animation remains optional behind tab", () => {
  assert(solveBranch.includes('"Animation"'), "animation tab missing");
  assert(solveBranch.includes('View Animation'), "CTA to animation missing");
  assert(solveBranch.includes('solveTab === "Animation"'), "animation content should be tab-gated");
});

milestone("No old fantasy ornament remains in solve shell", () => {
  for (const forbidden of ["cloud-tile.svg", "Original pixel cloud ornament", "wood-sign-panel rounded-3xl p-5 shadow-xl shadow-cyan-950/20"]) {
    assert(!solveBranch.includes(forbidden), `solve shell still contains ${forbidden}`);
  }
});
