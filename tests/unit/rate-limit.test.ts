import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimiter, createUsageLimiter } from "../../lib/rate-limit.ts";

test("allows up to the limit, then reports when to retry", () => {
  const check = createRateLimiter({ limit: 2, windowMs: 10_000 });
  assert.equal(check("a", 0).allowed, true);
  assert.equal(check("a", 1_000).allowed, true);
  assert.deepEqual(check("a", 4_000), { allowed: false, retryAfterSeconds: 6 });
});

test("keys are counted separately and windows reset", () => {
  const check = createRateLimiter({ limit: 1, windowMs: 10_000 });
  assert.equal(check("a", 0).allowed, true);
  assert.equal(check("b", 0).allowed, true);
  assert.equal(check("a", 9_999).allowed, false);
  assert.equal(check("a", 10_000).allowed, true);
});

test("memory stays bounded when many keys arrive", () => {
  const check = createRateLimiter({ limit: 1, windowMs: 10_000, maxKeys: 3 });
  for (let i = 0; i < 50; i += 1) assert.equal(check(`key-${i}`, i).allowed, true);
  // The newest key is still tracked even though older ones were evicted.
  assert.equal(check("key-49", 60).allowed, false);
});

test("usage limiter allows one operation in flight per key", () => {
  const usage = createUsageLimiter({ budget: 10_000, windowMs: 60_000, maxConcurrent: 1 });
  assert.equal(usage.begin("a", 0).allowed, true);
  assert.deepEqual(usage.begin("a", 10), { allowed: false, retryAfterSeconds: 1, reason: "busy" });
  assert.equal(usage.begin("b", 10).allowed, true);
  usage.end("a", 100, 100);
  assert.equal(usage.begin("a", 110).allowed, true);
});

test("usage limiter stops a key that has spent its budget until the window resets", () => {
  const usage = createUsageLimiter({ budget: 10_000, windowMs: 60_000, maxConcurrent: 1 });
  for (const startedAt of [0, 6_000]) {
    assert.equal(usage.begin("a", startedAt).allowed, true);
    usage.end("a", 5_500, startedAt + 5_500);
  }
  assert.deepEqual(usage.begin("a", 12_000), { allowed: false, retryAfterSeconds: 48, reason: "budget" });
  assert.equal(usage.begin("a", 60_000).allowed, true);
});

test("cheap operations barely touch the budget", () => {
  const usage = createUsageLimiter({ budget: 10_000, windowMs: 60_000, maxConcurrent: 1 });
  for (let i = 0; i < 25; i += 1) {
    assert.equal(usage.begin("a", i * 400).allowed, true);
    usage.end("a", 300, i * 400 + 300);
  }
});
