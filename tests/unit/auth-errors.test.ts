import assert from "node:assert/strict";
import test from "node:test";
import { describeMagicLinkError } from "../../lib/supabase/auth-errors.ts";

test("magic-link rate limits are reported as retryable 429s", () => {
  assert.deepEqual(describeMagicLinkError({ code: "over_email_send_rate_limit", status: 429 }).status, 429);
  // Older responses carry only the HTTP status.
  assert.equal(describeMagicLinkError({ status: 429 }).code, "over_email_send_rate_limit");
});

test("disabled email sign-in is distinguishable from a bad address", () => {
  assert.equal(describeMagicLinkError({ code: "otp_disabled" }).status, 503);
  assert.equal(describeMagicLinkError({ code: "signup_disabled" }).status, 503);
  assert.equal(describeMagicLinkError({ code: "email_address_invalid" }).status, 400);
});

test("unknown failures keep the Supabase code for diagnosis without leaking its message", () => {
  const failure = describeMagicLinkError({ code: "unexpected_failure", status: 500 });
  assert.equal(failure.code, "unexpected_failure");
  assert.equal(failure.status, 502);
  assert.equal(describeMagicLinkError({}).code, "unknown");
});
