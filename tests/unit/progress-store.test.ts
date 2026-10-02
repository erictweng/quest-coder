import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// The store reads its path at import time, so point it at a throwaway database first.
process.env.QUEST_CODER_DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "quest-coder-")), "test.sqlite");
const store = await import("../../lib/progress-store.ts");

const QUEST = { challengeId: "quest-1", baseXp: 100, shards: 0 };
const BOSS = { challengeId: "boss", baseXp: 100, shards: 1, review: { packSlug: "pack", topic: "dp", schedule: [1, 3, 7] } };

function session() {
  return store.newSession("Tester").tokenHash;
}

test("a session resolves from its token and can be renamed", () => {
  const created = store.newSession("First");
  assert.equal(store.sessionForToken(created.token)?.displayName, "First");
  store.renameSession(created.tokenHash, "Second");
  assert.equal(store.sessionForToken(created.token)?.displayName, "Second");
  assert.equal(store.sessionForToken("not-a-token"), null);
});

test("first clear grants the reward once", () => {
  const hash = session();
  const first = store.applyAuthoritativeClear(hash, QUEST);
  assert.equal(first.grant?.xp, 100);
  const second = store.applyAuthoritativeClear(hash, QUEST);
  assert.equal(second.grant, null);
  assert.equal(second.progress.rewards.xp, 100);
  assert.equal(second.progress.cleared["quest-1"], true);
});

test("reward is scaled by help the server recorded", () => {
  const hinted = session();
  store.recordHintOpened(hinted, "quest-1", 3);
  assert.equal(store.applyAuthoritativeClear(hinted, { ...QUEST, hintMultiplier: 0.75 }).grant?.xp, 75);

  // Without a configured hint multiplier, hints are free.
  const freeHints = session();
  store.recordHintOpened(freeHints, "quest-1", 3);
  assert.equal(store.applyAuthoritativeClear(freeHints, QUEST).grant?.xp, 100);

  const customSolution = session();
  store.recordSolutionOpened(customSolution, "quest-1");
  assert.equal(store.applyAuthoritativeClear(customSolution, { ...QUEST, solutionMultiplier: 0.2 }).grant?.xp, 20);

  const assisted = session();
  store.recordHintOpened(assisted, "quest-1", 3);
  store.recordSolutionOpened(assisted, "quest-1");
  assert.equal(store.applyAuthoritativeClear(assisted, QUEST).grant?.xp, 50);
});

test("opened hints are capped at the number of hints", () => {
  const hash = session();
  for (let i = 0; i < 5; i += 1) store.recordHintOpened(hash, "quest-1", 2);
  assert.equal(store.readServerProgress(hash).hintsOpened["quest-1"], 2);
});

test("client writes cannot change server-owned state", () => {
  const hash = session();
  store.applyAuthoritativeClear(hash, QUEST);
  store.writeClientProgress(hash, {
    cleared: { boss: true },
    rewards: { xp: 999_999, shards: 99 },
    hintsOpened: { "quest-1": 0 },
    reviews: { pack: { rating: 2400 } },
    savedCode: { "quest-1": "draft" },
    attempts: { "quest-1": [{ id: "a" }] },
    friendsEnabled: true
  });
  const saved = store.readServerProgress(hash);
  assert.deepEqual(saved.cleared, { "quest-1": true });
  assert.equal(saved.rewards.xp, 100);
  assert.deepEqual(saved.reviews, {});
  assert.equal(saved.savedCode["quest-1"], "draft");
  assert.equal(saved.attempts["quest-1"].length, 1);
  assert.equal(saved.friendsEnabled, true);
});

test("server actions do not lose client drafts", () => {
  const hash = session();
  store.writeClientProgress(hash, { savedCode: { "quest-1": "draft" } });
  store.recordHintOpened(hash, "quest-1", 3);
  store.applyAuthoritativeClear(hash, QUEST);
  assert.equal(store.readServerProgress(hash).savedCode["quest-1"], "draft");
});

test("boss clears schedule a review that advances only when it is due", () => {
  const hash = session();
  const now = new Date("2026-01-01T00:00:00.000Z");
  const first = store.applyAuthoritativeClear(hash, BOSS, now).progress.reviews.pack;
  assert.equal(first.intervalDays, 1);
  assert.equal(first.nextDueAt, "2026-01-02T00:00:00.000Z");
  assert.equal(first.streak, 1);
  assert.equal(first.rating, 1080);

  // Resubmitting before the review is due earns nothing.
  const early = store.applyAuthoritativeClear(hash, BOSS, new Date("2026-01-01T12:00:00.000Z"));
  assert.equal(early.grant, null);
  assert.deepEqual(early.progress.reviews.pack, first);

  const due = store.applyAuthoritativeClear(hash, BOSS, new Date("2026-01-02T00:00:00.000Z")).progress.reviews.pack;
  assert.equal(due.intervalDays, 3);
  assert.equal(due.streak, 2);
  assert.equal(due.rating, 1160);
  assert.deepEqual(store.readServerProgress(hash).reviews.pack, due);
});

test("assisted boss wins come back sooner than clean wins", () => {
  const base = { packSlug: "pack", bossId: "boss", topic: "dp", schedule: [1, 3, 7], now: new Date("2026-01-01T00:00:00.000Z") };
  const existing = store.nextReview(store.nextReview(undefined, { ...base, hintCount: 0, solutionAssisted: false }), { ...base, hintCount: 0, solutionAssisted: false });
  assert.equal(existing.intervalDays, 3);
  assert.equal(store.nextReview(existing, { ...base, hintCount: 0, solutionAssisted: false }).intervalDays, 7);
  assert.equal(store.nextReview(existing, { ...base, hintCount: 2, solutionAssisted: false }).intervalDays, 3);
  assert.equal(store.nextReview(undefined, { ...base, hintCount: 0, solutionAssisted: true }).intervalDays, 1);
});

test("shop preview costs one shard, once", () => {
  const hash = session();
  assert.equal(store.unlockShopPreview(hash).rewards.shopPreviewUnlocked, false);
  store.applyAuthoritativeClear(hash, BOSS);
  const unlocked = store.unlockShopPreview(hash);
  assert.equal(unlocked.rewards.shards, 0);
  assert.equal(unlocked.rewards.shopPreviewUnlocked, true);
  assert.equal(store.unlockShopPreview(hash).rewards.shards, 0);
  assert.equal(store.readServerProgress(hash).rewards.shopPreviewUnlocked, true);
});
