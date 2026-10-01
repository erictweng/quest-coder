#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const sprintPlan = readFileSync(`${root}/docs/UI_UX_SPRINT_PLAN.md`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_11_SMOKE_TESTS.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

const hubIndex = page.indexOf('surface === "hub" ? (');
const profileIndex = page.indexOf('surface === "profile" ? (');
const campaignIndex = page.indexOf('surface === "campaigns" ? (');
const hubBranch = page.slice(hubIndex, profileIndex);
const profileBranch = page.slice(profileIndex, campaignIndex);

milestone("Sprint 11 roadmap is wired", () => {
  for (const token of ["Sprint 11 — Hub, profile card, and campaign entry", "Profile", "Campaign", "Questions", "Continue Last Quest"]) {
    assert(sprintPlan.includes(token), `Sprint 11 plan missing ${token}`);
  }
  assert(sprintDoc.includes("npm run smoke:sprint11"), "Sprint 11 smoke doc missing command");
});

milestone("Hub has three primary cards", () => {
  assert(hubIndex > -1, "hub branch missing");
  for (const token of ["Save file", "Quest map", "Quest board", "Profile", "Campaign", "Questions"]) {
    assert(hubBranch.includes(token), `hub missing ${token}`);
  }
});

milestone("Continue Last Quest CTA exists", () => {
  assert(hubBranch.includes("Continue Last Quest"), "continue CTA missing");
  assert(hubBranch.includes("selectChallenge(activeChallenge.id)"), "continue CTA should enter solve flow");
});

milestone("Compact stats strip includes Sprint 11 metrics", () => {
  for (const token of ["Streak/rating", "Bosses defeated", "Reviews due", "XP", "Shards"]) {
    assert(page.includes(token), `stats strip missing ${token}`);
  }
});

milestone("Companion dialogue is present", () => {
  assert(hubBranch.includes("Pixel companion"), "companion heading missing");
  assert(hubBranch.includes("Pick a path first"), "companion line missing");
});

milestone("Hub avoids full editor and replay theater", () => {
  assert(!hubBranch.includes("textarea"), "hub should not render code editor");
  assert(!hubBranch.includes("SceneRenderer"), "hub should not render replay theater");
});

milestone("Profile surface includes card, rewards, attempts, and review reminders", () => {
  for (const token of ["Profile save file", "RewardPanel", "Recent attempts", "Review reminders", "FriendPanel"]) {
    assert(profileBranch.includes(token), `profile surface missing ${token}`);
  }
});
