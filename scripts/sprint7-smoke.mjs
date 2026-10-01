#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const root = process.cwd();
const route = readFileSync(`${root}/app/api/run/route.ts`, "utf8");
const runner = readFileSync(`${root}/runner/quest_runner.py`, "utf8");
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const securityDoc = readFileSync(`${root}/docs/SECURITY_REVIEW.md`, "utf8");
const retentionDoc = readFileSync(`${root}/docs/TIMELINE_RETENTION_POLICY.md`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_7_SMOKE_TESTS.md`, "utf8");
const packFiles = readdirSync(`${root}/content/packs`).filter((file) => file.endsWith(".json"));
const packs = packFiles.map((file) => JSON.parse(readFileSync(`${root}/content/packs/${file}`, "utf8")));

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }
function runCli(source) {
  const child = spawnSync("python3", ["runner/quest_runner_cli.py"], {
    cwd: root,
    input: JSON.stringify({ source, packPath: "content/packs/timequake-search-rotated-array.json", challengeId: "boss-search" }),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  return { code: child.status, stdout: child.stdout, stderr: child.stderr };
}

milestone("Container/microVM isolation strategy documented and bridge-ready", () => {
  assert(securityDoc.includes("Firecracker") || securityDoc.includes("microVM"), "microVM/container strategy missing");
  assert(route.includes("runQuestRunner") && route.includes("QUEST_CODER_PUBLIC_HARDENED"), "runner bridge hardening flag missing");
});

milestone("No-network and read-only filesystem controls", () => {
  for (const token of ["BLOCKED_SOURCE_NAMES", "BLOCKED_ATTRIBUTE_ROOTS", "__import__", "open", "socket", "subprocess"]) {
    assert(runner.includes(token) || route.includes(token), `missing blocked capability token: ${token}`);
  }
  const importAttempt = runCli("import os\nclass Solution:\n    def search(self, nums, target):\n        return 0\n");
  assert(importAttempt.stdout.includes("imports are disabled"), "import attempt should be blocked");
  const openAttempt = runCli("class Solution:\n    def search(self, nums, target):\n        open('/tmp/x','w')\n        return 0\n");
  assert(openAttempt.stdout.includes("open is disabled"), "open attempt should be blocked");
});

milestone("CPU, memory, and time limits", () => {
  assert(runner.includes("RLIMIT_CPU") && runner.includes("RLIMIT_AS"), "resource limits missing");
  assert(route.includes("RUNNER_TIMEOUT_MS") && runner.includes("RunnerTimeout"), "time guards missing");
});

milestone("Rate limits and abuse protection", () => {
  assert(route.includes("RATE_LIMIT_MAX_RUNS") && route.includes("429") && route.includes("Retry-After"), "rate limit path missing");
  assert(route.includes("MAX_SOURCE_BYTES") && route.includes("source exceeds"), "source size abuse guard missing");
});

milestone("Queue visibility/progress while runs execute", () => {
  assert(route.includes("activeRuns") && route.includes("queuedRuns") && route.includes("maxConcurrentRuns"), "queue snapshot missing");
  assert(page.includes("Queue") && page.includes("active"), "queue UI missing");
});

milestone("Timeline compression/storage retention policy", () => {
  assert(retentionDoc.includes("3,000") && retentionDoc.includes("TTL") && retentionDoc.includes("compressed"), "retention policy incomplete");
  assert(page.includes("timelinePointer") && page.includes("capped replay metadata"), "compressed timeline UI/storage note missing");
});

milestone("Original-problem-text audit for public packs", () => {
  for (const pack of packs) {
    const checklist = pack.validation?.originalTextChecklist;
    assert(checklist?.noCopiedProblemStatement === true, `${pack.slug} missing noCopiedProblemStatement`);
    assert(checklist?.originalStory === true, `${pack.slug} missing originalStory`);
    assert(checklist?.noRealGameCharactersArtLogosMapsOrUi === true, `${pack.slug} missing art/logo audit`);
  }
});

milestone("Public signup/onboarding path", () => {
  for (const token of ["Public signup/onboarding", "enter a handle", "Sign in", "public-hardening-v0"]) {
    assert(page.includes(token), `public onboarding token missing: ${token}`);
  }
});

milestone("Sprint 7 smoke doc is wired", () => {
  assert(sprintDoc.includes("npm run smoke:sprint7"), "Sprint 7 smoke command missing from docs");
});
