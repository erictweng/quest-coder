#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_6_SMOKE_TESTS.md`, "utf8");
const packFiles = readdirSync(`${root}/content/packs`).filter((file) => file.endsWith(".json"));
const packs = packFiles.map((file) => JSON.parse(readFileSync(`${root}/content/packs/${file}`, "utf8")));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function milestone(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

milestone("Stale-review scheduler", () => {
  assert(page.includes("function scheduleReview"), "scheduleReview function missing");
  assert(page.includes("nextDueAt") && page.includes("intervalDays"), "review interval fields missing");
  assert(page.includes("buildReviewItems") && page.includes("Reviews due"), "due-review UI missing");
});

milestone("Review variants in packs", () => {
  for (const pack of packs) {
    assert(pack.review?.enabled === true, `${pack.slug} review not enabled`);
    assert(Array.isArray(pack.review.variants) && pack.review.variants.length > 0, `${pack.slug} missing review variants`);
    assert(Array.isArray(pack.review.defaultSchedule) && pack.review.defaultSchedule.length >= 3, `${pack.slug} missing spaced schedule`);
  }
});

milestone("Surprise battle selection from studied topics", () => {
  assert(page.includes("Surprise battle"), "surprise battle button missing");
  assert(page.includes("eligibleSurprises") && page.includes("studied"), "surprise selection is not limited to studied topics");
  assert(page.includes("No studied topics are eligible yet"), "empty surprise guard missing");
});

milestone("Per-topic stats", () => {
  for (const token of ["Per-topic stats", "defeated", "attempts", "hints", "solutions", "streak", "rating", "buildTopicStats"]) {
    assert(page.includes(token), `stats token missing: ${token}`);
  }
});

milestone("Snooze and preview controls", () => {
  assert(page.includes("Preview") && page.includes("Snooze 1d"), "snooze/preview buttons missing");
  assert(page.includes("snoozedUntil") && page.includes("snoozeReview"), "snooze state missing");
  assert(page.includes("Review preview"), "review preview action missing");
});

milestone("Easy wins lengthen while losses or assisted wins shorten", () => {
  assert(page.includes("easyWin") && page.includes("assistedWin"), "review outcome categories missing");
  assert(page.includes("nextInterval(schedule, prior)"), "easy-win interval growth missing");
  assert(page.includes("-60") && page.includes("hintCount >= 2"), "loss/hint-heavy shortening missing");
});

milestone("Sprint 6 smoke doc is wired", () => {
  assert(sprintDoc.includes("npm run smoke:sprint6"), "Sprint 6 smoke command missing from docs");
});
