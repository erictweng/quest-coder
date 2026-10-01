#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const checklist = readFileSync(`${root}/docs/VISUAL_QUALITY_CHECKLIST.md`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_5_SMOKE_TESTS.md`, "utf8");
const packFiles = readdirSync(`${root}/content/packs`).filter((file) => file.endsWith(".json"));
const packs = packFiles.map((file) => JSON.parse(readFileSync(`${root}/content/packs/${file}`, "utf8")));
const linkedPacks = packs.filter((pack) => pack.scene.type === "linked_list");
const bossCount = packs.length;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function milestone(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

function run(command, args, options = {}) {
  const child = spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 30 * 1024 * 1024, ...options });
  assert(child.status === 0, `${command} ${args.join(" ")} failed\nSTDOUT:\n${child.stdout}\nSTDERR:\n${child.stderr}`);
  return child;
}

function runCli(pack, challenge) {
  const child = run("python3", ["runner/quest_runner_cli.py"], {
    input: JSON.stringify({ source: challenge.solution.code, packPath: `content/packs/${pack.slug}.json`, challengeId: challenge.id })
  });
  return JSON.parse(child.stdout);
}

milestone("Linked-list portal/island scene renderer", () => {
  assert(page.includes("Linked-list portal/island scene"), "linked-list scene renderer missing");
  assert(page.includes("portal") && page.includes("island"), "portal/island visual language missing");
  assert(page.includes("pointer movement / relinking visible"), "pointer movement copy missing");
});

milestone("Reverse Linked List quest pack", () => {
  const pack = packs.find((item) => item.slug === "reverse-linked-list");
  assert(pack, "reverse-linked-list pack missing");
  assert(pack.boss.id === "boss-reverse-linked-list", "reverse boss missing");
  assert(runCli(pack, pack.boss).status === "passed", "reverse boss should pass");
});

milestone("Merge Two Sorted Lists quest pack", () => {
  const pack = packs.find((item) => item.slug === "merge-two-sorted-lists");
  assert(pack, "merge-two-sorted-lists pack missing");
  assert(pack.boss.id === "boss-merge-two-lists", "merge boss missing");
  assert(runCli(pack, pack.boss).status === "passed", "merge boss should pass");
});

milestone("Linked List Cycle quest pack", () => {
  const pack = packs.find((item) => item.slug === "linked-list-cycle");
  assert(pack, "linked-list-cycle pack missing");
  assert(pack.boss.id === "boss-linked-list-cycle", "cycle boss missing");
  assert(runCli(pack, pack.boss).status === "passed", "cycle boss should pass");
});

milestone("Library contains at least 5 total questions", () => {
  assert(bossCount >= 5, `expected at least 5 packs/questions, found ${bossCount}`);
  assert(page.includes("PACKS.length"), "app should expose pack count");
});

milestone("Visual quality review checklist for each pack", () => {
  for (const name of ["Timequake", "Plain Binary Search", "Reverse Linked List", "Merge Two Sorted Lists", "Linked List Cycle"]) {
    assert(checklist.includes(name), `visual checklist missing ${name}`);
  }
});

milestone("Pointer movement/relinking visible for linked-list problems", () => {
  for (const pack of linkedPacks) {
    const result = runCli(pack, pack.boss);
    assert(result.replay.input.structure === "linked_list", `${pack.slug} replay should be linked_list`);
    assert(result.replay.events.some((event) => event.ref?.structure === "linked_list"), `${pack.slug} missing linked-list read events`);
  }
});

milestone("Every boss replay meets Sprint 5 visual bar", () => {
  for (const pack of packs) {
    const result = runCli(pack, pack.boss);
    const kinds = new Set(result.replay.events.map((event) => event.kind));
    assert(result.status === "passed", `${pack.slug} boss failed`);
    assert(kinds.has("line") && kinds.has("read") && kinds.has("outcome"), `${pack.slug} replay lacks visual timeline events`);
    assert(pack.validation.visualQualityChecklist?.outcomeVisualsDistinct === true, `${pack.slug} visual checklist incomplete`);
  }
});

milestone("Sprint 5 smoke doc is wired", () => {
  assert(sprintDoc.includes("npm run smoke:sprint5"), "Sprint 5 smoke command missing from docs");
});
