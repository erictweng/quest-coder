import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const pack = JSON.parse(readFileSync("runner/packs/forest-of-patience-climbing-stairs.json", "utf8"));
const path = [...pack.quests, pack.boss];

async function setCode(page: import("@playwright/test").Page, code: string) {
  await page.getByLabel("Python solution editor").fill(code);
}

async function submitAndAdvance(page: import("@playwright/test").Page, challenge: any, final = false) {
  await setCode(page, challenge.solution.code);
  await page.getByRole("button", { name: final ? "Submit Boss" : "Submit all" }).click();
  await expect(page.getByTestId("completion-floating-panel")).toBeVisible();
  await expect(page.getByText(final ? "Boss cleared" : "Quest passed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: final ? "Return to campaign" : "Move to next quest" }).click();
}

test("trusted Climbing Stairs journey is submit-gated and durable", async ({ page, context }) => {
  await page.goto("/");
  await page.getByLabel("User name").fill("E2E Ranger");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Signed in as")).toContainText("E2E Ranger");
  await page.getByRole("button", { name: "Continue Last Quest" }).click();

  const failureCases = [
    { source: "def count_routes(n)\n    return 1", text: /compile_error|syntax/i },
    { source: "def count_routes(n):\n    raise Exception('boom')", text: /runtime_error|boom/i },
    { source: "def count_routes(n):\n    while True:\n        pass", text: /loop_guard|terminate/i, timeout: 15_000 },
    { source: "import os\ndef count_routes(n):\n    return 1", text: /imports are disabled|runtime_error/i }
  ];
  for (const sample of failureCases) {
    await setCode(page, sample.source);
    await page.getByRole("button", { name: "Run basic" }).click();
    await expect(page.getByTestId("result-summary")).toContainText(sample.text, { timeout: sample.timeout ?? 5_000 });
  }

  await setCode(page, "def count_routes(n):\n    return 999");
  await page.getByRole("button", { name: "Submit all" }).click();
  await expect(page.getByTestId("result-summary")).toContainText("Submit did not clear the quest");
  await expect(page.getByTestId("completion-floating-panel")).toHaveCount(0);

  await setCode(page, path[0].solution.code);
  await page.getByRole("button", { name: "Run basic" }).click();
  await expect(page.getByText("Basic checks passed.")).toBeVisible();
  await expect(page.getByTestId("completion-floating-panel")).toHaveCount(0);
  await page.getByRole("button", { name: /quest notebook/i }).click();
  await expect(page.getByRole("button", { name: "Q2" })).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await submitAndAdvance(page, path[0]);
  await expect(page.getByRole("heading", { name: path[1].title })).toBeVisible();
  await submitAndAdvance(page, path[1]);
  await expect(page.getByRole("heading", { name: path[2].title })).toBeVisible();
  await submitAndAdvance(page, path[2]);
  await expect(page.getByRole("heading", { name: pack.boss.title })).toBeVisible();
  await submitAndAdvance(page, pack.boss, true);

  const response = await context.request.get("/api/progress");
  expect(response.ok()).toBeTruthy();
  const saved = (await response.json()).progress;
  expect(Object.keys(saved.cleared).filter((id) => saved.cleared[id])).toHaveLength(4);
  expect(saved.rewards.xp).toBe(210);
  expect(saved.rewards.shards).toBe(1);

  await page.reload();
  await expect(page.getByText("Signed in as")).toContainText("E2E Ranger");
  const reloaded = await context.request.get("/api/progress");
  expect((await reloaded.json()).progress.rewards.xp).toBe(210);
});

test("runner unavailable clears stale success and gives retry guidance", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("User name").fill("Unavailable Ranger");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  await setCode(page, path[0].solution.code);
  await page.getByRole("button", { name: "Run basic" }).click();
  await expect(page.getByText("Basic checks passed.")).toBeVisible();
  await page.route("**/api/run", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Runner service is unavailable. Retry shortly.", code: "runner_unavailable" }) }));
  await page.getByRole("button", { name: "Run basic" }).click();
  await expect(page.getByText(/Runner service is unavailable/)).toBeVisible();
  await expect(page.getByText("Basic checks passed.")).toHaveCount(0);
  await expect(page.getByTestId("completion-floating-panel")).toHaveCount(0);
});

test("runner boundary fails closed and hides submit fixtures", async ({ request }) => {
  const unauthorized = await request.post("http://127.0.0.1:8788/v1/runs", { data: { source: "pass", packSlug: pack.slug, challengeId: path[0].id, mode: "run" } });
  expect(unauthorized.status()).toBe(401);

  const source = path[0].solution.code;
  const session = await request.post("/api/session", { data: { displayName: "Boundary Test" } });
  expect(session.ok()).toBeTruthy();
  await request.put("/api/progress", { data: { progress: { cleared: { [path[0].id]: true }, rewards: { xp: 999999, shards: 99, grants: [] }, savedCode: {} } } });
  const protectedProgress = (await (await request.get("/api/progress")).json()).progress;
  expect(protectedProgress.cleared[path[0].id]).not.toBe(true);
  expect(protectedProgress.rewards.xp).toBe(0);
  const locked = await request.post("/api/run", { data: { source: path[1].solution.code, packSlug: pack.slug, challengeId: path[1].id, mode: "submit" } });
  expect(locked.status()).toBe(409);
  expect((await locked.json()).code).toBe("prerequisite_locked");
  const bad = await request.post("/api/run", { data: { source, packSlug: pack.slug, challengeId: "../../etc/passwd", mode: "submit" } });
  expect(bad.status()).toBe(400);

  const submit = await request.post("/api/run", { data: { source, packSlug: pack.slug, challengeId: path[0].id, mode: "submit", solutionAssisted: true, hintCount: 0 } });
  expect(submit.ok()).toBeTruthy();
  const payload = await submit.json();
  expect(payload.cases.every((item: any) => item.caseId.startsWith("hidden-") && item.expected === null && Object.keys(item.arguments).length === 0)).toBeTruthy();
  const assistedProgress = (await (await request.get("/api/progress")).json()).progress;
  expect(assistedProgress.rewards.xp).toBe(13);
  const repeated = await request.post("/api/run", { data: { source, packSlug: pack.slug, challengeId: path[0].id, mode: "submit", solutionAssisted: false, hintCount: 0 } });
  expect(repeated.ok()).toBeTruthy();
  expect((await (await request.get("/api/progress")).json()).progress.rewards.xp).toBe(13);
});
