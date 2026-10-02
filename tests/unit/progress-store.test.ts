import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { configuredProgressBackend, LocalProgressStore, SupabaseProgressStore } from "../../lib/progress-store.ts";

const QUEST = { challengeId: "quest-1", baseXp: 100, shards: 0 };
const BOSS = { challengeId: "boss", baseXp: 100, shards: 1, review: { packSlug: "pack", topic: "dp", schedule: [1, 3, 7] } };

function store() {
  const path = join(mkdtempSync(join(tmpdir(), "quest-coder-")), "test.sqlite");
  return new LocalProgressStore(path);
}

function session(local: LocalProgressStore, name = "Tester") {
  return local.createSession(name).tokenHash;
}

test("backend selection uses local only when every Supabase variable is absent", () => {
  assert.equal(configuredProgressBackend({}), "local");
  assert.equal(configuredProgressBackend({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
    SUPABASE_SERVICE_ROLE_KEY: "service"
  }), "supabase");
  assert.throws(() => configuredProgressBackend({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }), /incomplete/);
});

test("a local session resolves from its token and can be renamed", () => {
  const local = store();
  const created = local.createSession("First");
  assert.equal(local.sessionForToken(created.token)?.displayName, "First");
  local.renameSession(created.tokenHash, "Second");
  assert.equal(local.sessionForToken(created.token)?.displayName, "Second");
  assert.equal(local.sessionForToken("not-a-token"), null);
});

test("progress is isolated by immutable user key", async () => {
  const local = store();
  const first = session(local, "Same Display Name");
  const second = session(local, "Same Display Name");
  await local.writeClient(first, { savedCode: { "quest-1": "first" }, savedCodeVersions: { "quest-1": 0 } });
  await local.applyAuthoritativeClear(first, QUEST);
  assert.equal((await local.read(first)).savedCode["quest-1"], "first");
  assert.equal((await local.read(first)).cleared["quest-1"], true);
  assert.deepEqual((await local.read(second)).savedCode, {});
  assert.deepEqual((await local.read(second)).cleared, {});
});

test("first clear grants the reward once under concurrent requests", async () => {
  const local = store();
  const user = session(local);
  const results = await Promise.all(Array.from({ length: 8 }, () => local.applyAuthoritativeClear(user, QUEST)));
  assert.equal(results.filter((result) => result.grant !== null).length, 1);
  const saved = await local.read(user);
  assert.equal(saved.rewards.xp, 100);
  assert.equal(saved.cleared["quest-1"], true);
});

test("reward is scaled by help the server recorded", async () => {
  const local = store();
  const hinted = session(local);
  await local.recordHintOpened(hinted, "quest-1", 3);
  assert.equal((await local.applyAuthoritativeClear(hinted, { ...QUEST, hintMultiplier: 0.75 })).grant?.xp, 75);

  const customSolution = session(local);
  await local.recordSolutionOpened(customSolution, "quest-1");
  assert.equal((await local.applyAuthoritativeClear(customSolution, { ...QUEST, solutionMultiplier: 0.2 })).grant?.xp, 20);
});

test("stale multi-tab saves merge attempts and do not overwrite newer drafts", async () => {
  const local = store();
  const user = session(local);
  const tabA = await local.writeClient(user, {
    savedCode: { "quest-1": "newer" },
    savedCodeVersions: { "quest-1": 0 },
    attempts: { "quest-1": [{ id: "attempt-a", status: "passed" }] }
  });
  assert.equal(tabA.savedCodeVersions["quest-1"], 1);

  const merged = await local.writeClient(user, {
    savedCode: { "quest-1": "stale", "quest-2": "other-tab" },
    savedCodeVersions: { "quest-1": 0, "quest-2": 0 },
    attempts: { "quest-1": [{ id: "attempt-b", status: "wrong_answer" }] }
  });
  assert.equal(merged.savedCode["quest-1"], "newer");
  assert.equal(merged.savedCode["quest-2"], "other-tab");
  assert.deepEqual(merged.attempts["quest-1"].map((attempt) => (attempt as { id: string }).id), ["attempt-b", "attempt-a"]);
});

test("client saves cannot erase authoritative clears during interleaved mutations", async () => {
  const local = store();
  const user = session(local);
  const stale = await local.read(user);
  await Promise.all([
    local.applyAuthoritativeClear(user, QUEST),
    local.writeClient(user, {
      ...stale,
      cleared: {},
      rewards: { xp: 999999 },
      savedCode: { "quest-1": "draft" },
      savedCodeVersions: { "quest-1": 0 }
    })
  ]);
  const saved = await local.read(user);
  assert.equal(saved.cleared["quest-1"], true);
  assert.equal(saved.rewards.xp, 100);
  assert.equal(saved.savedCode["quest-1"], "draft");
});

test("boss reviews advance only when due and shop spending is atomic", async () => {
  const local = store();
  const user = session(local);
  const now = new Date("2026-01-01T00:00:00.000Z");
  const first = (await local.applyAuthoritativeClear(user, BOSS, now)).progress.reviews.pack;
  assert.equal(first.intervalDays, 1);
  const early = await local.applyAuthoritativeClear(user, BOSS, new Date("2026-01-01T12:00:00.000Z"));
  assert.deepEqual(early.progress.reviews.pack, first);
  const due = (await local.applyAuthoritativeClear(user, BOSS, new Date("2026-01-02T00:00:00.000Z"))).progress.reviews.pack;
  assert.equal(due.intervalDays, 3);

  const unlocks = await Promise.all([local.unlockShopPreview(user), local.unlockShopPreview(user)]);
  assert.ok(unlocks.some((progress) => progress.rewards.shopPreviewUnlocked));
  assert.equal((await local.read(user)).rewards.shards, 0);
});

test("pruning cascades only untouched idle sessions and preserves used saves", async () => {
  const local = store();
  const abandoned = local.createSession("Abandoned");
  const drafted = local.createSession("Drafted");
  await local.writeClient(drafted.tokenHash, { savedCode: { "quest-1": "draft" }, savedCodeVersions: { "quest-1": 0 } });
  const later = new Date(Date.now() + 2 * 60 * 60_000);
  assert.ok(local.pruneUntouchedSessions(60 * 60_000, later) >= 1);
  assert.equal(local.sessionForToken(abandoned.token), null);
  assert.equal(local.sessionForToken(drafted.token)?.displayName, "Drafted");
  assert.equal((await local.read(drafted.tokenHash)).savedCode["quest-1"], "draft");
});

test("Supabase store sends the authenticated UUID only to service RPCs", async () => {
  const calls: Array<{ schema: string; name: string; args: Record<string, unknown> }> = [];
  const client = {
    schema(schema: string) {
      return {
        async rpc(name: string, args: Record<string, unknown>) {
          calls.push({ schema, name, args });
          return { data: { version: 0, cleared: {}, rewards: {} }, error: null };
        }
      };
    }
  };
  const supabase = new SupabaseProgressStore(client as never);
  await supabase.read("11111111-1111-1111-1111-111111111111");
  assert.deepEqual(calls[0], {
    schema: "quest_coder",
    name: "quest_coder_read_progress",
    args: { p_user_id: "11111111-1111-1111-1111-111111111111" }
  });
});

test("migration structurally enforces RLS, ownership, row locks, and service-only writes", () => {
  const sql = readFileSync(resolve("supabase/migrations/202610020001_quest_coder_auth_progress.sql"), "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /auth\.uid\(\)[\s\S]*user_id/i);
  assert.match(sql, /for update/gi);
  assert.match(sql, /revoke all on all functions in schema quest_coder from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function quest_coder\.quest_coder_apply_clear.*service_role/i);
  assert.match(sql, /references auth\.users\(id\) on delete cascade/i);
});
