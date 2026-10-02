#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const completionComponent = readFileSync(`${root}/components/completion-moment.tsx`, "utf8");
const feedbackComponent = readFileSync(`${root}/components/result-summary.tsx`, "utf8");
const route = readFileSync(`${root}/app/api/run/route.ts`, "utf8");
const runnerClient = readFileSync(`${root}/lib/runner-client.ts`, "utf8");
const css = readFileSync(`${root}/app/globals.css`, "utf8");
const publicPack = JSON.parse(readFileSync(`${root}/content/public/forest-of-patience-climbing-stairs.json`, "utf8"));
const privatePack = JSON.parse(readFileSync(`${root}/runner/packs/forest-of-patience-climbing-stairs.json`, "utf8"));
const editing = await import(pathToFileURL(`${root}/lib/python-editing.ts`).href);
const attempts = await import(pathToFileURL(`${root}/lib/attempts.ts`).href);
const runnerBoundary = await import(pathToFileURL(`${root}/lib/runner-client.ts`).href);

function assert(value, message) { if (!value) throw new Error(message); }
async function milestone(name, fn) { await fn(); console.log(`ok - ${name}`); }
function runCli(source, challengeId, mode) {
  const child = spawnSync("python3", ["runner/quest_runner_cli.py"], {
    cwd: root, encoding: "utf8",
    input: JSON.stringify({ source, packSlug: privatePack.slug, challengeId, mode }),
    maxBuffer: 20 * 1024 * 1024
  });
  assert(child.status === 0, child.stderr);
  return JSON.parse(child.stdout);
}

await milestone("Next.js uses an authenticated external runner and no grading fallback", async () => {
  for (const token of ["parseRunRequest", "submitToRunner", "RunnerBoundaryError", "isolated-runner-service-v1", 'fallback: "disabled"']) assert(route.includes(token), `route missing ${token}`);
  for (const forbidden of ["child_process", "spawn(", "runClimbingStairsFallback", "python-runtime"]) assert(!route.includes(forbidden), `route still contains ${forbidden}`);
  assert(runnerClient.includes("QUEST_CODER_RUNNER_URL") && runnerClient.includes("QUEST_CODER_RUNNER_TOKEN"), "runner client credentials missing");
  assert(runnerClient.includes("runner_unavailable") && runnerClient.includes("AbortController"), "runner fail-closed/timeout logic missing");
});

await milestone("Misconfigured runner fails closed instead of grading source", async () => {
  const savedUrl = process.env.QUEST_CODER_RUNNER_URL;
  const savedToken = process.env.QUEST_CODER_RUNNER_TOKEN;
  delete process.env.QUEST_CODER_RUNNER_URL;
  delete process.env.QUEST_CODER_RUNNER_TOKEN;
  let failure;
  try {
    await runnerBoundary.submitToRunner({ source: "def count_routes(n):\n    return 999", packSlug: privatePack.slug, challengeId: privatePack.quests[0].id, mode: "submit" });
  } catch (error) { failure = error; }
  if (savedUrl === undefined) delete process.env.QUEST_CODER_RUNNER_URL; else process.env.QUEST_CODER_RUNNER_URL = savedUrl;
  if (savedToken === undefined) delete process.env.QUEST_CODER_RUNNER_TOKEN; else process.env.QUEST_CODER_RUNNER_TOKEN = savedToken;
  assert(failure instanceof runnerBoundary.RunnerBoundaryError && failure.status === 503 && failure.code === "runner_unavailable", "runner should fail closed with 503");
});

await milestone("Private submit fixtures are separated from the browser pack", async () => {
  for (const challenge of [...publicPack.quests, publicPack.boss]) {
    assert(Array.isArray(challenge.tests.run), `${challenge.id} public run tests missing`);
    assert(!("submit" in challenge.tests) && !("fixed" in challenge.tests), `${challenge.id} leaks private tests`);
  }
  for (const challenge of [...privatePack.quests, privatePack.boss]) assert(challenge.tests.submit.length > challenge.tests.run.length, `${challenge.id} private suite missing`);
  assert(page.includes("content/public/forest-of-patience-climbing-stairs.json"), "client does not use public pack");
});

await milestone("Real Python execution rejects wrong code and passes references", async () => {
  const quest = privatePack.quests[0];
  const correct = runCli(quest.solution.code, quest.id, "submit");
  const wrong = runCli("def count_routes(n):\n    return 999", quest.id, "submit");
  assert(correct.passed && correct.cases.length === quest.tests.submit.length, "reference submit failed");
  assert(!wrong.passed && wrong.status === "wrong_answer", "wrong code was not executed");
});

await milestone("Submit-only progression and stale-result clearing are wired", async () => {
  for (const token of [
    'const authoritativeClear = attempt.mode === "submit" && attempt.passed',
    'runResult.passed && mode === "submit"',
    'result?.passed && result.execution.mode === "submit"',
    "setResult(null)", "setRunError(null)", "Basic checks passed.", "Submit all to clear"
  ]) assert(page.includes(token), `progression missing ${token}`);
});

await milestone("Failure feedback, attempts, and editor ergonomics survive", async () => {
  assert(page.includes("ResultSummary"), "feedback component is not wired");
  for (const token of ["Submit did not clear the quest", "Open a hint", 'data-testid="result-summary"']) assert(feedbackComponent.includes(token), `feedback missing ${token}`);
  for (const token of ['data-testid="case-row"', 'data-testid="attempt-row"']) assert(page.includes(token), `feedback missing ${token}`);
  const edit = editing.enterEdit("if ready:", 9, 9);
  assert(edit.value === "if ready:\n    ", "colon indentation failed");
  const attempt = attempts.attemptFromFailure("runner unavailable", { challengeId: "q", packSlug: privatePack.slug, mode: "submit", solutionAssisted: false, hintCount: 0 });
  assert(attempt.status === "internal_error" && attempts.describeAttempt(attempt).includes("runner unavailable"), "failure attempt missing");
});

await milestone("Completion moment and final campaign CTA exist", async () => {
  assert(page.includes("CompletionMoment"), "completion component is not wired");
  for (const token of ["Move to next quest", "Return to campaign", "firework", "✓"]) assert(completionComponent.includes(token), `completion missing ${token}`);
  assert(css.includes("@keyframes gentle-firework"), "gentle fireworks CSS missing");
});
