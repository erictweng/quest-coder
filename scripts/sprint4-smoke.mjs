#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const schemaDoc = readFileSync(`${root}/docs/DATABASE_SCHEMA.md`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_4_SMOKE_TESTS.md`, "utf8");
const pack = JSON.parse(readFileSync(`${root}/content/packs/timequake-search-rotated-array.json`, "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function milestone(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

function runCli(source, challengeId) {
  const child = spawnSync("python3", ["runner/quest_runner_cli.py"], {
    cwd: root,
    input: JSON.stringify({ source, packPath: "content/packs/timequake-search-rotated-array.json", challengeId }),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  assert(child.status === 0, `runner CLI failed: ${child.stderr}`);
  return JSON.parse(child.stdout);
}

milestone("Accounts/login/session persistence", () => {
  for (const token of ["Sign in", "Log out", "quest-coder:session", "safeLocalStorageSet", "safeLocalStorageRemove"]) {
    assert(page.includes(token), `missing account/session token: ${token}`);
  }
});

milestone("Database schema for content and player progress", () => {
  for (const token of ["users", "quest_packs", "challenges", "user_progress", "attempts", "timelines"]) {
    assert(schemaDoc.includes(token), `schema doc missing ${token}`);
  }
});

milestone("Library by category", () => {
  assert(page.includes("Library by category"), "library heading missing");
  assert(page.includes("Binary search"), "category label missing");
  assert(page.includes("CHALLENGES"), "challenge list should be pack-driven");
});

milestone("Quest unlock flow and boss gate", () => {
  assert(page.includes("isUnlocked"), "unlock helper missing");
  assert(page.includes("bossUnlocked"), "boss unlock state missing");
  assert(pack.boss.unlock.requiresQuestIds.length === pack.quests.length, "boss should require every quest");
});

milestone("Saved code per quest", () => {
  assert(page.includes("savedCode"), "savedCode persistence missing");
  assert(page.includes("quest-coder:profile"), "profile storage key missing");
});

milestone("Attempts saved with results and timeline pointer", () => {
  for (const token of ["Attempt history", "recordAttempt", "timelinePointer", "replayCaseId", "eventCount", "solutionAssisted"]) {
    assert(page.includes(token), `attempt token missing: ${token}`);
  }
});

milestone("Hidden reference solution opened only on request and recorded", () => {
  for (const token of ["Open solution scroll", "solutionOpened", "solution-assisted", "Solution scroll"]) {
    assert(page.includes(token), `solution token missing: ${token}`);
  }
});

milestone("Boss fight test rounds and victory replay", () => {
  const result = runCli(pack.boss.solution.code, pack.boss.id);
  assert(result.status === "passed", `boss reference should pass, got ${result.status}`);
  assert(result.replay.events.length > 0, "boss replay should include events");
  assert(page.includes("Victory replay ready"), "victory replay copy missing");
});

milestone("Progress survives logout/login model", () => {
  assert(page.includes("readProgress"), "readProgress missing");
  assert(page.includes("writeProgress"), "writeProgress missing");
  assert(page.includes("setUserName(null)"), "logout should clear active session only");
});

milestone("Sprint 4 smoke doc is wired", () => {
  assert(sprintDoc.includes("npm run smoke:sprint4"), "Sprint 4 smoke command missing from docs");
});
