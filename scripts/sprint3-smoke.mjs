#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const packPath = `${root}/content/packs/timequake-search-rotated-array.json`;
const pack = JSON.parse(readFileSync(packPath, "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, options = {}) {
  const child = spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, ...options });
  return child;
}

function runOk(command, args, options = {}) {
  const child = run(command, args, options);
  assert(child.status === 0, `${command} ${args.join(" ")} failed\nSTDOUT:\n${child.stdout}\nSTDERR:\n${child.stderr}`);
  return child;
}

function runCli(source, challengeId) {
  const child = runOk("python3", ["runner/quest_runner_cli.py"], {
    input: JSON.stringify({ source, packPath: "content/packs/timequake-search-rotated-array.json", challengeId })
  });
  return JSON.parse(child.stdout);
}

function milestone(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

const challenges = [...pack.quests, pack.boss];

milestone("Quest-pack JSON schema exists and Timequake pack is converted", () => {
  const schema = JSON.parse(readFileSync(`${root}/schemas/quest-pack.schema.json`, "utf8"));
  assert(schema.properties.quests, "schema must describe quests");
  assert(pack.status === "validated", "pack should be marked validated");
  assert(pack.quests.length >= 2, "pack should have multiple quests");
  for (const challenge of challenges) {
    assert(challenge.entrypoint, `${challenge.id} missing entrypoint`);
    assert(challenge.solution.code.trim(), `${challenge.id} missing reference solution`);
    assert(challenge.tests.fixed.length > 0, `${challenge.id} missing fixed tests`);
  }
});

milestone("Pack validator accepts Timequake and runs references", () => {
  const child = runOk("python3", ["scripts/validate_pack.py", "content/packs/timequake-search-rotated-array.json"]);
  const result = JSON.parse(child.stdout);
  assert(result.status === "validated", "validator should return validated status");
  assert(result.challengeCount === challenges.length, "validator should run every quest and boss");
});

milestone("Broken reference solution causes pack rejection", () => {
  const dir = mkdtempSync(join(tmpdir(), "quest-pack-broken-"));
  try {
    const broken = structuredClone(pack);
    broken.quests[0].solution.code = broken.quests[0].solution.code.replace("return mid", "return -999");
    const file = join(dir, "broken.json");
    writeFileSync(file, JSON.stringify(broken));
    const child = run("python3", ["scripts/validate_pack.py", file]);
    assert(child.status !== 0, "broken reference should fail validation");
    assert(child.stderr.includes("reference solution failed"), "broken reference failure should be explicit");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

milestone("Missing scene spec causes pack rejection", () => {
  const dir = mkdtempSync(join(tmpdir(), "quest-pack-scene-"));
  try {
    const broken = structuredClone(pack);
    delete broken.scene;
    const file = join(dir, "missing-scene.json");
    writeFileSync(file, JSON.stringify(broken));
    const child = run("python3", ["scripts/validate_pack.py", file]);
    assert(child.status !== 0, "missing scene should fail validation");
    assert(child.stderr.includes("missing top-level field: scene") || child.stderr.includes("missing scene spec"), "missing scene failure should be explicit");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

milestone("Scene-render smoke checks cover every quest and boss", () => {
  for (const challenge of challenges) {
    const result = runCli(challenge.solution.code, challenge.id);
    assert(result.status === "passed", `${challenge.id} should pass through runner`);
    const kinds = new Set(result.replay.events.map((event) => event.kind));
    assert(kinds.has("line"), `${challenge.id} missing line event`);
    assert(kinds.has("read"), `${challenge.id} missing read event`);
    assert(kinds.has("outcome"), `${challenge.id} missing outcome event`);
    assert(result.replay.input.structure === pack.scene.type, `${challenge.id} replay input should match scene type`);
  }
});

milestone("Loader serves validated content", () => {
  assert(readFileSync(`${root}/lib/quests.ts`, "utf8").includes("loadQuestPack"), "loader should expose loadQuestPack");
  assert(readFileSync(`${root}/app/api/packs/[slug]/route.ts`, "utf8").includes("loadQuestPack"), "pack API should use loader");
  assert(readFileSync(`${root}/app/api/run/route.ts`, "utf8").includes("findChallenge"), "run API should select challenges through loader");
});

milestone("App can run every quest and boss from the pack", () => {
  for (const challenge of challenges) {
    const result = runCli(challenge.solution.code, challenge.id);
    assert(result.passed === true, `${challenge.id} should be runnable from pack`);
  }
});

milestone("Original-text checklist is enforced", () => {
  assert(pack.metadata.originalTextConfirmed === true, "metadata originalTextConfirmed should be true");
  assert(pack.validation.originalTextChecklist.noCopiedProblemStatement === true, "copied-text checklist missing");
  assert(pack.validation.originalTextChecklist.originalStory === true, "original story checklist missing");
  assert(pack.validation.originalTextChecklist.noRealGameCharactersArtLogosMapsOrUi === true, "real-game checklist missing");
});

milestone("Sprint 3 smoke doc is wired", () => {
  const doc = readFileSync(`${root}/docs/SPRINT_3_SMOKE_TESTS.md`, "utf8");
  assert(doc.includes("npm run smoke:sprint3"), "Sprint 3 smoke command missing from docs");
});
