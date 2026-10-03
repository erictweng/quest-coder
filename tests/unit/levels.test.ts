import assert from "node:assert/strict";
import { test } from "node:test";
import { levelFromXp, xpForLevel } from "../../lib/levels.ts";

test("level thresholds follow 10·(L−1)·(L+4)", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(xpForLevel), [0, 60, 140, 240, 360]);
  assert.throws(() => xpForLevel(0));
  assert.throws(() => xpForLevel(1.5));
});

test("levels are derived from XP with progress toward the next level", () => {
  assert.deepEqual(levelFromXp(0), { level: 1, title: "Squire", xpIntoLevel: 0, xpForNext: 60, totalXp: 0 });
  assert.equal(levelFromXp(59).level, 1);
  assert.deepEqual(levelFromXp(60), { level: 2, title: "Apprentice", xpIntoLevel: 0, xpForNext: 80, totalXp: 60 });
  // Clearing the whole Forest of Patience pack (25 + 30 + 30 + 125 XP).
  assert.deepEqual(levelFromXp(210), { level: 3, title: "Journeyman", xpIntoLevel: 70, xpForNext: 100, totalXp: 210 });
});

test("bad XP values are treated as zero, and very high levels keep the top title", () => {
  for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(levelFromXp(bad).level, 1);
  assert.equal(levelFromXp(12.9).totalXp, 12);
  assert.equal(levelFromXp(xpForLevel(20)).title, "Legend");
  assert.equal(levelFromXp(xpForLevel(20)).level, 20);
});
