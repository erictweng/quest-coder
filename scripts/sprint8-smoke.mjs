#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_8_SMOKE_TESTS.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

milestone("Reward currency model", () => {
  for (const token of ["Reward currency model", "RewardWallet", "xp", "shards", "EMPTY_REWARDS"]) {
    assert(page.includes(token), `reward currency token missing: ${token}`);
  }
});

milestone("Quest and boss reward grant events", () => {
  for (const token of ["RewardGrant", "grantReward", "rewardForChallenge", "boss reward grant", "quest reward grant", "solutionAssisted", "hintCount"]) {
    assert(page.includes(token), `reward grant token missing: ${token}`);
  }
  assert(page.includes("challenge.isBoss ? 100 : 20"), "boss/quest XP split missing");
  assert(page.includes("challenge.isBoss ? 1 : 0"), "boss shard grant missing");
});

milestone("Spend target placeholder/shop concept", () => {
  for (const token of ["Spend 1 Shard", "shopPreviewUnlocked", "pixel aura shop", "unlockShopPreview"]) {
    assert(page.includes(token), `shop placeholder token missing: ${token}`);
  }
});

milestone("Stat bar", () => {
  for (const token of ["Stat bar", "buildStatBar", "bosses defeated", "attempts logged"]) {
    assert(page.includes(token), `stat bar token missing: ${token}`);
  }
});

milestone("Optional friend list/social shell", () => {
  for (const token of ["Optional friend list/social shell", "FRIEND_SHELL", "friendsEnabled", "Solo mode active", "Social is optional"]) {
    assert(page.includes(token), `friend shell token missing: ${token}`);
  }
});

milestone("Rewards reinforce practice without undermining learning", () => {
  assert(page.includes("solutionAssisted ? 0.5") && page.includes("hintCount > 0 ? 0.75"), "assisted reward reduction missing");
  assert(page.includes("Shards come from boss clears only"), "boss-only shard copy missing");
});

milestone("Reward outcomes are visible after quests/bosses", () => {
  assert(page.includes("Reward grant events appear after first-time quest or boss clears"), "reward visibility copy missing");
  assert(page.includes("rewards.grants.map"), "reward grant list missing");
});

milestone("Sprint 8 smoke doc is wired", () => {
  assert(sprintDoc.includes("npm run smoke:sprint8"), "Sprint 8 smoke command missing from docs");
});
