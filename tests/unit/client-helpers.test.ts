import assert from "node:assert/strict";
import { test } from "node:test";
import { appendAttempt, attemptFromFailure, attemptFromResult, describeAttempt, MAX_ATTEMPTS_PER_CHALLENGE } from "../../lib/attempts.ts";
import { enterEdit, tabEdit } from "../../lib/python-editing.ts";

const CONTEXT = { challengeId: "q", packSlug: "pack", mode: "submit" as const, solutionAssisted: false, hintCount: 0, now: new Date("2026-01-01T00:00:00.000Z") };

test("an attempt summarises the runner result", () => {
  const attempt = attemptFromResult({ status: "wrong_answer", passed: false, cases: [{ passed: true }, { passed: false }], replay: { caseId: "c1", summary: { eventCount: 7 } } }, CONTEXT);
  assert.equal(attempt.passedCases, 1);
  assert.equal(attempt.totalCases, 2);
  assert.equal(attempt.eventCount, 7);
  assert.equal(describeAttempt(attempt), "Submit all · wrong_answer · 1/2 cases");
});

test("a failed runner call is still recorded as an attempt", () => {
  const attempt = attemptFromFailure("runner unavailable", CONTEXT);
  assert.equal(attempt.status, "internal_error");
  assert.match(describeAttempt(attempt), /runner unavailable/);
});

test("attempt history is newest first and capped", () => {
  let history = {};
  for (let i = 0; i < MAX_ATTEMPTS_PER_CHALLENGE + 5; i += 1) history = appendAttempt(history, { ...attemptFromFailure("x", CONTEXT), id: `a${i}` });
  const list = (history as Record<string, Array<{ id: string }>>).q;
  assert.equal(list.length, MAX_ATTEMPTS_PER_CHALLENGE);
  assert.equal(list[0].id, `a${MAX_ATTEMPTS_PER_CHALLENGE + 4}`);
});

test("Enter after a colon indents the next line", () => {
  assert.equal(enterEdit("if ready:", 9, 9).value, "if ready:\n    ");
});

test("Tab inserts indentation at the cursor", () => {
  const edit = tabEdit("x", 0, 0);
  assert.equal(edit.value, "    x");
  assert.equal(edit.selectionStart, 4);
});
