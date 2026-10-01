#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const route = readFileSync(`${root}/app/api/run/route.ts`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_2_SMOKE_TESTS.md`, "utf8");

const passing = `class Solution:\n    def search(self, nums: List[int], target: int) -> int:\n        l = 0\n        r = len(nums) - 1\n        while l <= r:\n            mid = (l + r) // 2\n            if nums[mid] == target:\n                return mid\n            if nums[l] <= nums[mid]:\n                if nums[l] <= target < nums[mid]:\n                    r = mid - 1\n                else:\n                    l = mid + 1\n            else:\n                if nums[mid] < target <= nums[r]:\n                    l = mid + 1\n                else:\n                    r = mid - 1\n        return -1\n`;

const wrong = `class Solution:\n    def search(self, nums: List[int], target: int) -> int:\n        return -1\n`;

const syntax = `class Solution:\n    def search(self, nums: List[int], target: int) -> int\n        return 0\n`;
const crash = `class Solution:\n    def search(self, nums: List[int], target: int) -> int:\n        return 1 / 0\n`;
const offEnd = `class Solution:\n    def search(self, nums: List[int], target: int) -> int:\n        return nums[len(nums)]\n`;
const loop = `class Solution:\n    def search(self, nums: List[int], target: int) -> int:\n        while True:\n            pass\n`;
const linear = `class Solution:\n    def search(self, nums: List[int], target: int) -> int:\n        for i, value in enumerate(nums):\n            if value == target:\n                return i\n        return -1\n`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCli(source) {
  const child = spawnSync("python3", ["runner/quest_runner_cli.py"], {
    cwd: root,
    input: JSON.stringify({ source }),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  assert(child.status === 0, `runner CLI failed: ${child.stderr}`);
  return JSON.parse(child.stdout);
}

function milestone(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

milestone("React app shell with question page", () => {
  assert(page.includes("Question + code editor"), "question page heading missing");
  assert(page.includes("Quest Coder · Sprint 2 Replay Theater"), "app shell title missing");
});

milestone("Code editor keyboard contract", () => {
  for (const token of ["Line numbers", "event.key === \"Tab\"", "event.shiftKey", "auto-indent", "metaKey", "ctrlKey", "font-feature-settings"]) {
    assert(page.includes(token), `editor token missing: ${token}`);
  }
});

milestone("API/local service bridge submits code to runner", () => {
  assert(route.includes("quest_runner_cli.py"), "API route does not call runner CLI");
  const result = runCli(wrong);
  assert(result.status === "wrong_answer", `expected wrong_answer, got ${result.status}`);
  assert(result.execution.replayCaseIndex === 0, "first failing test should be selected for replay");
});

milestone("Replay player consumes timeline contract", () => {
  const result = runCli(passing);
  assert(result.status === "passed", `expected passed, got ${result.status}`);
  assert(result.replay.events.some((event) => event.kind === "line"), "line events missing");
  assert(result.replay.events.some((event) => event.kind === "read"), "read events missing");
  assert(result.replay.events.at(-1).kind === "outcome", "outcome event missing");
  assert(result.replay.events.some((event) => event.vars && Object.prototype.hasOwnProperty.call(event.vars, "mid")), "mid variable movement missing");
});

milestone("Array scene doors and skyline", () => {
  assert(page.includes("Array scene:"), "array scene missing");
  assert(page.includes("doors"), "doors mode missing");
  assert(page.includes("skyline"), "skyline mode missing");
});

milestone("Outcome visuals for every Sprint 2 status", () => {
  const expected = {
    wrong_answer: runCli(wrong).status,
    compile_error: runCli(syntax).status,
    runtime_error: runCli(crash).status,
    off_end_read: runCli(offEnd).status,
    loop_guard: runCli(loop).status,
    over_budget: runCli(linear).status,
    passed: runCli(passing).status
  };
  for (const [status, observed] of Object.entries(expected)) {
    assert(observed === status, `expected ${status}, got ${observed}`);
    assert(page.includes(`${status}:`), `visual mapping missing for ${status}`);
  }
});

milestone("Playback controls", () => {
  for (const token of ["Play", "Pause", "Step", "Back", "onSkipStart", "onSkipEnd", "onSpeed", "PLAY_SPEEDS"]) {
    assert(page.includes(token), `playback token missing: ${token}`);
  }
});

milestone("3,000-step cap responsiveness", () => {
  const result = runCli(passing);
  assert(result.limits.maxEvents === 3000, "max event cap should be 3000");
  assert(result.replay.summary.eventCount <= 3000, "replay exceeded 3000 events");
});

milestone("Sprint 2 smoke doc is wired", () => {
  assert(sprintDoc.includes("npm run smoke:sprint2"), "Sprint 2 smoke command missing from docs");
});
