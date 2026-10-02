import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionFromSupabaseUser } from "../../lib/auth-identity.ts";

test("Supabase session identity maps progress to immutable auth UUID, not display name", () => {
  const session = sessionFromSupabaseUser({
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    email: "player@example.com",
    user_metadata: { display_name: "Mutable Ranger" }
  });
  assert.equal(session.userId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  assert.equal(session.progressKey, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  assert.equal(session.rateLimitKey, "supabase:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  assert.equal(session.displayName, "Mutable Ranger");
  assert.equal(session.provider, "supabase");
});

test("Supabase session presentation name falls back to email without changing key", () => {
  const session = sessionFromSupabaseUser({ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", email: "coder@example.com" });
  assert.equal(session.displayName, "coder");
  assert.equal(session.progressKey, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
});
