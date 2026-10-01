#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const sprintPlan = readFileSync(`${root}/docs/UI_UX_SPRINT_PLAN.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

milestone("Sprint 10 IA shell is documented", () => {
  for (const token of ["Sprint 10 — IA shell and state extraction", "Hub → Campaign → Questions List → Focused Question Solve Screen", "quest-coder-ui-ux", "progressive-disclosure-product-ia", "coding-editor-ux"]) {
    assert(sprintPlan.includes(token), `Sprint 10 plan missing ${token}`);
  }
});

milestone("App surface state exists", () => {
  for (const token of ["type AppSurface", "hub", "profile", "campaigns", "questions", "solve", "setSurface"]) {
    assert(page.includes(token), `surface state missing ${token}`);
  }
});

milestone("Landing hub avoids default editor overload", () => {
  const hubIndex = page.indexOf('surface === "hub" ? (');
  const solveIndex = page.indexOf('surface === "questions" ? (');
  assert(hubIndex > -1, "hub branch missing");
  assert(solveIndex > -1, "solve branch missing");
  assert(hubIndex < solveIndex, "hub should render before solve branch");
  const hubBranch = page.slice(hubIndex, solveIndex);
  for (const token of ["Profile", "Campaign", "Questions", "Continue Last Quest", "compiler when the quest starts"]) {
    assert(hubBranch.includes(token), `hub branch missing ${token}`);
  }
  assert(!hubBranch.includes("textarea"), "hub branch should not render the code editor");
  assert(!hubBranch.includes("SceneRenderer"), "hub branch should not render replay theater");
});

milestone("Question selection opens solve mode", () => {
  assert(page.includes("function selectChallenge"), "selectChallenge helper missing");
  assert(page.includes('setSurface("solve")'), "question selection should enter solve mode");
  assert(page.includes("onSelect={selectChallenge}"), "library should preserve solve selection flow");
});

milestone("Progress state shape remains preserved", () => {
  for (const token of ["cleared", "solutionOpened", "hintsOpened", "attempts", "savedCode", "reviews", "rewards", "friendsEnabled"]) {
    assert(page.includes(token), `progress shape missing ${token}`);
  }
});
