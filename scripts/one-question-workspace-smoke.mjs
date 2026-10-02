#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const pack = JSON.parse(readFileSync(`${root}/content/packs/forest-of-patience-climbing-stairs.json`, "utf8"));

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }
function runCli(mode) {
  const source = pack.boss.solution.code;
  const child = spawnSync("python3", ["runner/quest_runner_cli.py"], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify({ source, packPath: `content/packs/${pack.slug}.json`, challengeId: pack.boss.id, mode }),
    maxBuffer: 20 * 1024 * 1024
  });
  assert(child.status === 0, `${mode} runner failed\nSTDOUT:\n${child.stdout}\nSTDERR:\n${child.stderr}`);
  return JSON.parse(child.stdout);
}

milestone("Only Climbing Stairs is active", () => {
  assert(page.includes("const PACKS = [climbingStairsPack]"), "app should only expose climbing stairs pack");
  for (const retiredImport of ["timequake-search-rotated-array.json", "reverse-linked-list.json", "merge-two-sorted-lists.json", "linked-list-cycle.json", "plain-binary-search.json"]) {
    assert(!page.includes(retiredImport), `retired pack import still active: ${retiredImport}`);
  }
});

milestone("Full-screen compiler and tiny Home top bar exist", () => {
  for (const token of ["Full-screen compiler workspace", "one-question-workspace", "Home", "full-screen focus", "Python solution editor", "Console / result drawer"]) {
    assert(page.includes(token), `workspace missing ${token}`);
  }
});

milestone("Quest Notebook overlay is bottom-right and carries prompt tabs", () => {
  for (const token of ["quest-notebook-toggle fixed bottom-5 right-5", "Quest Notebook", "quest-notebook-panel fixed", "Mini quest path", "ProblemDetails", "Animation", "Hints", "Solution", "Submissions"]) {
    assert(page.includes(token), `notebook missing ${token}`);
  }
});

milestone("Solution requires confirmation", () => {
  assert(page.includes("Solution is hidden"), "solution hidden copy missing");
  assert(page.includes("I want to view the solution"), "solution ask-confirm button missing");
  assert(page.includes("Reveal solution?"), "solution confirmation copy missing");
  assert(page.includes("Reveal solution"), "solution reveal button missing");
  assert(!page.includes("Load passing"), "player-facing Load passing should be removed");
});

milestone("Structured problem content is available", () => {
  for (const challenge of [...pack.quests, pack.boss]) {
    assert(challenge.problem?.statement, `${challenge.id} problem statement missing`);
    assert(challenge.problem?.gamifiedStatement, `${challenge.id} gamified statement missing`);
    assert(challenge.problem?.examples?.length === 2, `${challenge.id} should have two examples`);
  }
});

milestone("Run uses basic tests and Submit uses full tests", () => {
  const run = runCli("run");
  const submit = runCli("submit");
  assert(run.execution.mode === "run", "run mode missing");
  assert(submit.execution.mode === "submit", "submit mode missing");
  assert(run.cases.length === pack.boss.tests.run.length, "run suite size mismatch");
  assert(submit.cases.length === pack.boss.tests.submit.length, "submit suite size mismatch");
  assert(run.cases.length < submit.cases.length, "submit should run more cases than run");
  assert(run.replay.caseId === pack.boss.tests.replayCaseId, "run replay should use configured case");
  assert(submit.replay.caseId === pack.boss.tests.replayCaseId, "submit replay should use configured case");
});
