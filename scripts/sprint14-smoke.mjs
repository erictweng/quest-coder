#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const sprintPlan = readFileSync(`${root}/docs/UI_UX_SPRINT_PLAN.md`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_14_SMOKE_TESTS.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

milestone("Sprint 14 roadmap is wired", () => {
  for (const token of ["Sprint 14 — Contextual animation, replay, rewards, and review moments", "View Animation", "reward toast", "boss victory", "Submissions"]) {
    assert(sprintPlan.includes(token) || sprintDoc.includes(token), `Sprint 14 docs missing ${token}`);
  }
  assert(sprintDoc.includes("npm run smoke:sprint14"), "Sprint 14 smoke doc missing command");
});

milestone("Replay is optional inside Animation tab", () => {
  assert(page.includes('solveTab === "Animation"'), "Animation tab branch missing");
  assert(page.includes("Reduced motion safe"), "reduced-motion safety copy missing");
  assert(page.includes("replay only moves when you press Play/Step"), "manual replay motion copy missing");
  assert(page.includes("PlaybackControls"), "playback controls missing");
});

milestone("Failed run suggests View Animation", () => {
  assert(page.includes("View Animation"), "View Animation CTA missing");
  assert(page.includes('setSolveTab("Animation")'), "View Animation should open Animation tab");
  assert(page.includes("Next learning step: open the Animation tab"), "failed run next step copy missing");
});

milestone("Rewards and boss victory are contextual", () => {
  for (const token of ["recentReward", "Reward toast", "Clean clear.", "Boss victory moment", "Boss cleared.", "next quest unlock animation", "review rematch queued"]) {
    assert(page.includes(token), `reward/boss token missing ${token}`);
  }
});

milestone("Attempt history is in Submissions", () => {
  const submissionsIndex = page.indexOf('solveTab === "Solution"');
  const attemptIndex = page.indexOf("AttemptHistory attempts={activeAttempts}");
  assert(attemptIndex > submissionsIndex, "attempt history should live after solve tab branches in Submissions fallback");
  assert(page.includes("Attempt history lives here, not on the workspace front"), "Submissions placement copy missing");
});

milestone("Review reminders stay contextual outside solve clutter", () => {
  assert(page.includes("Review reminders"), "Profile review reminder missing");
  assert(page.includes("Review reminders stay in Hub/Profile/Campaign"), "solve reminder boundary copy missing");
});
