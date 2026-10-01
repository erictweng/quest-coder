#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const sprintPlan = readFileSync(`${root}/docs/UI_UX_SPRINT_PLAN.md`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_13_SMOKE_TESTS.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

const solveStart = page.indexOf('aria-label="Focused split-pane solve screen"');
const solveSource = page.slice(Math.max(0, solveStart - 800), page.indexOf('</section>\n          </section>', solveStart) + 30);

milestone("Sprint 13 roadmap is wired", () => {
  for (const token of ["Sprint 13 — Focused split-pane solve screen", "left pane: Question", "right pane: Code/compiler", "Animation", "Hints", "Solution", "Submissions"]) {
    assert(sprintPlan.includes(token), `Sprint 13 plan missing ${token}`);
  }
  assert(sprintDoc.includes("npm run smoke:sprint13"), "Sprint 13 smoke doc missing command");
});

milestone("Focused split-pane solve screen exists", () => {
  assert(solveStart > -1, "focused split-pane solve screen missing");
  for (const token of ["Focused question pane", "Code compiler pane", "Question", "Animation", "Hints", "Solution", "Submissions", "Mini campaign categories and quest path"]) {
    assert(solveSource.includes(token), `solve screen missing ${token}`);
  }
  assert(page.includes("Workspace mode: no dashboard chrome"), "compact solve header missing");
});

milestone("Question left and compiler right are explicit", () => {
  assert(page.includes('xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]'), "desktop split columns missing");
  assert(page.includes("Problem statement"), "problem statement block missing");
  assert(page.includes("Code on the right"), "right compiler heading missing");
  assert(page.includes("solution.py"), "editor filename badge missing");
});

milestone("Run, Submit, runtime, and result drawer exist", () => {
  for (const token of ["Python 3 · /api/run", "Run ▶", "Submit Boss", "Console / result drawer", "open the Animation tab"]) {
    assert(page.includes(token), `runner/control token missing ${token}`);
  }
});

milestone("Animation and help are secondary tabs", () => {
  assert(page.includes('solveTab === "Animation"'), "Animation tab branch missing");
  assert(page.includes('solveTab === "Hints"'), "Hints tab branch missing");
  assert(page.includes('solveTab === "Solution"'), "Solution tab branch missing");
  assert(page.includes('solveTab === "Submissions"') || page.includes(') : (\n                <div className="space-y-4">'), "Submissions branch missing");
  assert(!page.includes("LibraryPanel progress={progress}"), "old library sidebar should be removed from solve mode");
});

milestone("Saved code and /api/run integration remain intact", () => {
  assert(page.includes("progress.savedCode[activeChallenge.id]"), "saved code read missing");
  assert(page.includes('fetch("/api/run"'), "/api/run integration missing");
  assert(page.includes("handleEditorKeyDown"), "editor keyboard handler missing");
});
