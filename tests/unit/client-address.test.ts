import assert from "node:assert/strict";
import { test } from "node:test";
import { clientAddress } from "../../lib/client-address.ts";

function requestFrom(forwardedFor?: string) {
  return new Request("http://app.test/", { headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {} });
}

test("the forwarded header is ignored unless a trusted proxy is configured", () => {
  delete process.env.QUEST_CODER_TRUSTED_PROXY_HOPS;
  assert.equal(clientAddress(requestFrom("203.0.113.9")), null);
});

test("the client is counted from the right, past entries a caller could forge", () => {
  process.env.QUEST_CODER_TRUSTED_PROXY_HOPS = "1";
  assert.equal(clientAddress(requestFrom("10.0.0.1, 203.0.113.9")), "203.0.113.9");
  process.env.QUEST_CODER_TRUSTED_PROXY_HOPS = "2";
  assert.equal(clientAddress(requestFrom("spoofed, 203.0.113.9, 10.1.1.1")), "203.0.113.9");
  assert.equal(clientAddress(requestFrom()), null);
  delete process.env.QUEST_CODER_TRUSTED_PROXY_HOPS;
});
