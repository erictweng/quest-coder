#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const sprintPlan = readFileSync(`${root}/docs/UI_UX_SPRINT_PLAN.md`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_12_SMOKE_TESTS.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

const campaignsIndex = page.indexOf('surface === "campaigns" ? (');
const detailIndex = page.indexOf('surface === "campaignDetail" ? (');
const questionsIndex = page.indexOf('surface === "questions" ? (');
const campaignsBranch = page.slice(campaignsIndex, detailIndex);
const detailBranch = page.slice(detailIndex, questionsIndex);
const questionsBranch = page.slice(questionsIndex, page.indexOf(') : (', questionsIndex));

milestone("Sprint 12 roadmap is wired", () => {
  for (const token of ["Sprint 12 — Campaign map and questions list", "locked", "available", "cleared", "review due", "boss"]) {
    assert(sprintPlan.includes(token), `Sprint 12 plan missing ${token}`);
  }
  assert(sprintDoc.includes("npm run smoke:sprint12"), "Sprint 12 smoke doc missing command");
});

milestone("Campaigns screen exists and does not open editor directly", () => {
  assert(campaignsIndex > -1, "campaigns branch missing");
  for (const token of ["Campaign world", "openCampaign(pack.slug)", "Concepts:", "boss locked", "boss open"]) {
    assert(campaignsBranch.includes(token), `campaigns branch missing ${token}`);
  }
  assert(!campaignsBranch.includes("textarea"), "campaigns screen should not render editor");
});

milestone("Campaign detail quest board exists", () => {
  assert(detailIndex > -1, "campaign detail branch missing");
  for (const token of ["Campaign detail", "Quest node", "Boss node", "Back to campaigns", "StatusPill"]) {
    assert(detailBranch.includes(token), `campaign detail missing ${token}`);
  }
});

milestone("Quest statuses are labeled", () => {
  for (const token of ["locked", "available", "cleared", "review due", "boss", "gate locked", "gate open"]) {
    assert(detailBranch.includes(token) || questionsBranch.includes(token), `status missing ${token}`);
  }
});

milestone("Questions list filters exist", () => {
  for (const token of ["QuestionFilter", "All", "Available", "Cleared", "Review", "Boss", "setQuestionFilter"]) {
    assert(page.includes(token), `question filter missing ${token}`);
  }
});

milestone("Selecting quest still opens focused solve mode", () => {
  assert(page.includes("function selectChallenge"), "selectChallenge missing");
  assert(page.includes('setSurface("solve")'), "selectChallenge should open solve mode");
});
