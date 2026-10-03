import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { parseRunRequest } from "../../lib/run-contract.ts";
import { RunnerBoundaryError, runnerHealth, submitToRunner } from "../../lib/runner-client.ts";

const PAYLOAD = parseRunRequest({ source: "x = 1\n", packSlug: "forest-of-patience-climbing-stairs", challengeId: "boss-old-bramblehorn", mode: "run" });
const TOKEN = "expected-token";

/** A fake runner that only accepts the expected bearer token. */
async function fakeRunner(): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    const authorized = request.headers.authorization === `Bearer ${TOKEN}`;
    response.setHeader("content-type", "application/json");
    if (!authorized) { response.statusCode = 401; response.end(JSON.stringify({ error: "unauthorized", code: "unauthorized" })); return; }
    if (request.url === "/ready") { response.end(JSON.stringify({ status: "ok", version: "fake" })); return; }
    response.end(JSON.stringify({ status: "passed", passed: true, cases: [] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

async function withEnv<T>(url: string, token: string, fn: () => Promise<T>): Promise<T> {
  const previous = { url: process.env.QUEST_CODER_RUNNER_URL, token: process.env.QUEST_CODER_RUNNER_TOKEN };
  process.env.QUEST_CODER_RUNNER_URL = url;
  process.env.QUEST_CODER_RUNNER_TOKEN = token;
  try { return await fn(); } finally {
    if (previous.url === undefined) delete process.env.QUEST_CODER_RUNNER_URL; else process.env.QUEST_CODER_RUNNER_URL = previous.url;
    if (previous.token === undefined) delete process.env.QUEST_CODER_RUNNER_TOKEN; else process.env.QUEST_CODER_RUNNER_TOKEN = previous.token;
  }
}

test("a rejected runner token is a 503 server error, never a 401 that signs the player out", async () => {
  const { server, url } = await fakeRunner();
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (line: string) => { errors.push(line); };
  try {
    await withEnv(url, "wrong-token", async () => {
      await assert.rejects(submitToRunner(PAYLOAD), (error: unknown) => {
        assert.ok(error instanceof RunnerBoundaryError);
        assert.equal(error.status, 503);
        assert.equal(error.code, "runner_misconfigured");
        return true;
      });
      assert.equal((await runnerHealth()).available, false);
    });
    assert.ok(errors.some((line) => line.includes("runner_auth_rejected")));
    assert.ok(errors.every((line) => !line.includes("wrong-token")));
  } finally {
    console.error = originalError;
    server.close();
  }
});

test("whitespace pasted around the runner URL and token is ignored", async () => {
  const { server, url } = await fakeRunner();
  try {
    await withEnv(` ${url}/ \n`, `  ${TOKEN}\n`, async () => {
      const result = await submitToRunner(PAYLOAD);
      assert.equal(result.passed, true);
      assert.equal((await runnerHealth()).available, true);
    });
  } finally {
    server.close();
  }
});
