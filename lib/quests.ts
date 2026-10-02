import fs from "node:fs";
import path from "node:path";

export type QuestPack = {
  schemaVersion: "quest-pack.v0";
  id: string;
  slug: string;
  title: string;
  metadata: { shortDescription: string; originalTextConfirmed: boolean; displayName?: string; category?: string; topic?: string };
  oneQuestionMode?: { enabled: boolean; activeProblem: string; questionBuildOrder: string; runSuite: string; submitSuite: string; animationReplay: string };
  runtime: { language: "python"; entrypoint: string; timeLimitMs: number; timelineEventCap: number };
  scene: { type: "array" | "linked_list" | "tree" | "graph" | "custom"; renderer: string; outcomeVisuals: Record<string, string> };
  quests: QuestChallenge[];
  boss: QuestChallenge;
};

export type QuestChallenge = {
  id: string;
  title: string;
  brief: string;
  signature: string;
  entrypoint: string;
  starterCode: string;
  tests: { fixed: Array<Record<string, unknown>>; run?: Array<Record<string, unknown>>; submit?: Array<Record<string, unknown>>; replayCaseId?: string; replayCaseIds: string[] };
  problem?: { statement: string; gamifiedStatement: string; inputs: string[]; output: string; guarantees: string[]; examples: Array<{ input: string; output: string; explanation: string }> };
  budget: { enabled: boolean; unit: string; formula?: string; absoluteLimit?: number; failureMode: string };
  solution: { code: string; explanation: string; complexity: { time: string; space: string } };
};

const PACK_DIR = path.join(process.cwd(), "content", "packs");

export function listPackSlugs() {
  return fs
    .readdirSync(PACK_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""));
}

export function loadQuestPack(slug = "forest-of-patience-climbing-stairs"): QuestPack {
  const filePath = path.join(PACK_DIR, `${slug}.json`);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as QuestPack;
  if (raw.schemaVersion !== "quest-pack.v0") {
    throw new Error(`Unsupported quest pack schema for ${slug}`);
  }
  if (!raw.scene?.renderer) {
    throw new Error(`Quest pack ${slug} is missing a scene renderer`);
  }
  return raw;
}

export function findChallenge(pack: QuestPack, challengeId = pack.boss.id): QuestChallenge {
  const challenge = [...pack.quests, pack.boss].find((item) => item.id === challengeId);
  if (!challenge) {
    throw new Error(`Challenge not found: ${challengeId}`);
  }
  return challenge;
}

export function packPath(slug = "forest-of-patience-climbing-stairs") {
  return path.join("content", "packs", `${slug}.json`);
}
