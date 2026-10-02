#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = process.cwd();
const pack = JSON.parse(readFileSync(`${root}/content/packs/forest-of-patience-climbing-stairs.json`, "utf8"));
const page = readFileSync(`${root}/app/page.tsx`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }
function runReference(challenge) {
  const child = spawnSync("python3", ["runner/quest_runner_cli.py"], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify({ source: challenge.solution.code, packPath: `content/packs/${pack.slug}.json`, challengeId: challenge.id }),
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

milestone("Reference solutions pass all tests", () => {
  for (const challenge of [...pack.quests, pack.boss]) runReference(challenge);
});

milestone("Quest Coder app imports the Climbing Stairs pack", () => {
  assert(page.includes("forest-of-patience-climbing-stairs.json"), "app import missing");
  assert(page.includes("climbingStairsPack"), "PACKS wiring missing");
});
