#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = process.cwd();
const pack = JSON.parse(readFileSync(`${root}/runner/packs/forest-of-patience-climbing-stairs.json`, "utf8"));
const publicPack = JSON.parse(readFileSync(`${root}/content/public/forest-of-patience-climbing-stairs.json`, "utf8"));
const page = readFileSync(`${root}/app/page.tsx`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }
function runReference(challenge) {
  const child = spawnSync("python3", ["runner/quest_runner_cli.py"], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify({ source: challenge.solution.code, packSlug: pack.slug, challengeId: challenge.id, mode: "submit" }),
    maxBuffer: 20 * 1024 * 1024
  });
  assert(child.status === 0, `reference run failed for ${challenge.id}\nSTDOUT:\n${child.stdout}\nSTDERR:\n${child.stderr}`);
  const result = JSON.parse(child.stdout);
  assert(result.status === "passed", `reference did not pass for ${challenge.id}: ${result.status}`);
}

milestone("Climbing Stairs quest pack metadata", () => {
  assert(pack.schemaVersion === "quest-pack.v0", "schema version mismatch");
  assert(pack.slug === "forest-of-patience-climbing-stairs", "slug mismatch");
  assert(pack.metadata.displayName === "Climbing Stairs", "display name missing");
  assert(pack.metadata.category === "1-DP", "1-DP category missing");
  assert(pack.story.worldName === "Forest of Patience Dojo", "story world missing");
  assert(pack.concepts.includes("dynamic_programming"), "dynamic programming concept missing");
});

milestone("Forest of Patience story beats are implemented", () => {
  const text = JSON.stringify(pack);
  for (const token of ["Ranger Wren", "Forest of Patience", "ledge", "Flash Jump", "route scroll", "two-slot pouch", "Old Bramblehorn"]) {
    assert(text.includes(token), `story token missing ${token}`);
  }
});

milestone("Quest path models 1-DP progression", () => {
  const ids = pack.quests.map((quest) => quest.id);
  assert(ids.join("|") === "patience-last-jump|patience-route-scroll|patience-two-slot-pouch", "quest order mismatch");
  assert(pack.boss.id === "boss-old-bramblehorn", "boss missing");
  assert(pack.quests[0].solution.complexity.time === "O(2^n)", "Quest 1 should expose repeated recursion");
  assert(pack.quests[1].solution.complexity.space === "O(n)", "Quest 2 should use route scroll/table");
  assert(pack.quests[2].solution.complexity.space === "O(1)", "Quest 3 should use pouch/O(1) space");
  assert(pack.boss.solution.complexity.time === "O(n)", "boss should be O(n)");
});

milestone("One-question schema contains structured problem prompts", () => {
  assert(pack.oneQuestionMode?.enabled === true, "one-question mode should be enabled");
  for (const challenge of [...pack.quests, pack.boss]) {
    const problem = challenge.problem;
    assert(problem, `${challenge.id} problem object missing`);
    for (const field of ["statement", "gamifiedStatement", "output"]) {
      assert(typeof problem[field] === "string" && problem[field].length > 20, `${challenge.id} problem.${field} missing or too short`);
    }
    assert(Array.isArray(problem.inputs) && problem.inputs.length >= 1, `${challenge.id} inputs missing`);
    assert(Array.isArray(problem.guarantees) && problem.guarantees.length >= 2, `${challenge.id} guarantees missing`);
    assert(Array.isArray(problem.examples) && problem.examples.length === 2, `${challenge.id} should have exactly two examples`);
    for (const example of problem.examples) {
      assert(typeof example.input === "string" && example.input.length > 0, `${challenge.id} example input missing`);
      assert(typeof example.output === "string" && example.output.length > 0, `${challenge.id} example output missing`);
      assert(typeof example.explanation === "string" && example.explanation.length > 10, `${challenge.id} example explanation missing`);
    }
  }
});

milestone("One-question schema splits run, submit, and replay tests", () => {
  for (const challenge of [...pack.quests, pack.boss]) {
    const tests = challenge.tests;
    assert(Array.isArray(tests.run) && tests.run.length >= 1, `${challenge.id} run suite missing`);
    assert(Array.isArray(tests.submit) && tests.submit.length >= tests.run.length, `${challenge.id} submit suite missing or too small`);
    assert(Array.isArray(tests.fixed) && tests.fixed.length === tests.submit.length, `${challenge.id} fixed compatibility suite should mirror submit`);
    assert(typeof tests.replayCaseId === "string", `${challenge.id} replayCaseId missing`);
    assert(tests.submit.some((testCase) => testCase.id === tests.replayCaseId), `${challenge.id} replay case must exist in submit suite`);
    assert(tests.submit.length > tests.run.length, `${challenge.id} submit should include more cases than run`);
  }
});

milestone("Public pack excludes hidden submit fixtures", () => {
  for (const challenge of [...publicPack.quests, publicPack.boss]) {
    assert(Array.isArray(challenge.tests.run), `${challenge.id} public run suite missing`);
    assert(!("submit" in challenge.tests) && !("fixed" in challenge.tests), `${challenge.id} leaks hidden tests`);
  }
});

milestone("Reference solutions pass all submit tests", () => {
  for (const challenge of [...pack.quests, pack.boss]) runReference(challenge);
});

milestone("Quest Coder app only lists the Climbing Stairs pack", () => {
  assert(page.includes("content/public/forest-of-patience-climbing-stairs.json"), "public app import missing");
  assert(page.includes("const PACKS = [climbingStairsPack]"), "PACKS should contain only climbing stairs");
  for (const retiredImport of ["timequake-search-rotated-array.json", "reverse-linked-list.json", "merge-two-sorted-lists.json", "linked-list-cycle.json", "plain-binary-search.json"]) {
    assert(!page.includes(retiredImport), `app still imports retired pack ${retiredImport}`);
  }
});
