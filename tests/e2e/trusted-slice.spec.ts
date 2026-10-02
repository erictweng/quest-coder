import { expect, request as playwrightRequest, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const pack = JSON.parse(readFileSync("runner/packs/forest-of-patience-climbing-stairs.json", "utf8"));
const path = [...pack.quests, pack.boss];

async function signIn(page: Page, name: string) {
  await page.goto("/");
  // Text typed before the page hydrates is discarded, so retry until the sign-in takes.
  await expect(async () => {
    await page.getByLabel("User name").fill(name);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Signed in as")).toContainText(name, { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

async function setCode(page: Page, code: string) {
  await page.getByLabel("Python solution editor").fill(code);
}

async function submitAndAdvance(page: Page, challenge: any, final = false) {
  await setCode(page, challenge.solution.code);
  await page.getByRole("button", { name: final ? "Submit Boss" : "Submit all" }).click();
  await expect(page.getByTestId("completion-floating-panel")).toBeVisible();
  await expect(page.getByText(final ? "Boss cleared" : "Quest passed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: final ? "Return to campaign" : "Move to next quest" }).click();
}

test("trusted Climbing Stairs journey is submit-gated and durable", async ({ page, context }) => {
  await signIn(page, "E2E Ranger");
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

  // A non-terminating Submit must come back classified, not as a gateway timeout.
  await setCode(page, "def count_routes(n):\n    while True:\n        pass");
  await page.getByRole("button", { name: "Submit all" }).click();
  await expect(page.getByTestId("result-summary")).toContainText("loop_guard", { timeout: 15_000 });

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

  const saved = (await (await context.request.get("/api/progress")).json()).progress;
  expect(Object.keys(saved.cleared).filter((id) => saved.cleared[id])).toHaveLength(4);
  expect(saved.rewards.xp).toBe(210);
  expect(saved.rewards.shards).toBe(1);
  // The boss clear schedules a spaced review on the server, so it survives a reload.
  expect(saved.reviews[pack.slug].bossId).toBe(pack.boss.id);

  await page.reload();
  await expect(page.getByText("Signed in as")).toContainText("E2E Ranger");
  await expect(page.getByText("1/1 bosses defeated").first()).toBeVisible();
  const reloaded = (await (await context.request.get("/api/progress")).json()).progress;
  expect(reloaded.rewards.xp).toBe(210);
  expect(reloaded.reviews[pack.slug].bossId).toBe(pack.boss.id);
});

test("runner unavailable clears stale success and gives retry guidance", async ({ page }) => {
  await signIn(page, "Unavailable Ranger");
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

test("drafts survive a reload and logging out keeps the save", async ({ page, context }) => {
  await signIn(page, "Draft Ranger");
  await page.getByRole("button", { name: "Continue Last Quest" }).click();

  const draft = "def count_routes(n):\n    return 1  # my draft";
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/progress") && response.request().method() === "PUT" && (response.request().postData() ?? "").includes("my draft"));
  await setCode(page, draft);
  await saved;
  await page.reload();
  await expect(page.getByText("Signed in as")).toContainText("Draft Ranger");
  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  await expect(page.getByLabel("Python solution editor")).toHaveValue(draft);
  // Give the autosave a chance to (wrongly) write starter code back, then check the server copy.
  await page.waitForTimeout(1_000);
  expect((await (await context.request.get("/api/progress")).json()).progress.savedCode[path[0].id]).toBe(draft);

  await submitAndAdvance(page, path[0]);
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  // Signing in again on this browser resumes the same save, even under a new name.
  await page.getByLabel("User name").fill("Renamed Ranger");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Signed in as")).toContainText("Renamed Ranger");
  const resumed = (await (await context.request.get("/api/progress")).json()).progress;
  expect(resumed.cleared[path[0].id]).toBe(true);
  expect(resumed.rewards.xp).toBe(25);
  // The second quest is unlocked in the UI and on the server alike.
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(path[1].title) }).click();
  await setCode(page, path[1].solution.code);
  await page.getByRole("button", { name: "Submit all" }).click();
  await expect(page.getByTestId("completion-floating-panel")).toBeVisible();
});

test("hints and solutions come from the server", async ({ page, context }) => {
  await signIn(page, "Hint Ranger");
  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  await page.getByRole("button", { name: /quest notebook/i }).click();

  // Examples render on separate lines, not with a literal backslash-n.
  const example = page.locator("pre", { hasText: "Input:" }).first();
  await expect(example).toContainText("Output:");
  await expect(example).not.toContainText("\\n");

  const firstHint = path[0].hints[0].text;
  await page.getByRole("tab", { name: "Hints" }).click();
  await expect(page.getByText("Opened 0 of 3")).toBeVisible();
  await expect(page.getByText(firstHint)).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal a hint" }).click();
  await expect(page.getByText(firstHint)).toBeVisible();
  await expect(page.getByText("Opened 1 of 3")).toBeVisible();

  await page.getByRole("tab", { name: "Solution" }).click();
  await expect(page.getByText("Solution is hidden")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await setCode(page, path[0].solution.code);
  await page.getByRole("button", { name: "Run basic" }).click();
  await expect(page.getByText("Basic checks passed.")).toBeVisible();
  await page.getByRole("button", { name: "View Animation" }).click();
  await expect(page.getByRole("heading", { name: "Replayed call" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "Submit all" }).click();
  // The pack marks hints as free, so the clear still earns the full reward.
  await expect(page.getByTestId("completion-floating-panel")).toContainText("+25 XP");
  expect((await (await context.request.get("/api/progress")).json()).progress.rewards.xp).toBe(25);

  // The line trace shows the code that ran, even after the editor changes.
  await setCode(page, "# edited after the run");
  await page.getByRole("button", { name: "View Animation" }).click();
  await expect(page.getByText("Line movement").locator("..")).toContainText("count_routes");
  await expect(page.getByText("Line movement").locator("..")).not.toContainText("edited after the run");
});

test("runner boundary fails closed and hides submit fixtures", async ({ request }) => {
  const run = { source: path[0].solution.code, packSlug: pack.slug, challengeId: path[0].id };
  const unauthorized = await request.post("http://127.0.0.1:8788/v1/runs", { data: { ...run, source: "pass", mode: "run" } });
  expect(unauthorized.status()).toBe(401);

  // Without a session the app refuses before anything is executed.
  const anonymous = await playwrightRequest.newContext({ baseURL: "http://localhost:3170" });
  expect((await anonymous.post("/api/run", { data: { ...run, mode: "run" } })).status()).toBe(401);
  expect((await anonymous.post("/api/progress", { data: { action: "open_solution", challengeId: path[0].id } })).status()).toBe(401);
  await anonymous.dispose();

  // The browser pack carries no solutions, hint text or hidden cases.
  const publicPack = await (await request.get(`/api/packs/${pack.slug}`)).text();
  for (const challenge of path) {
    expect(publicPack).not.toContain(JSON.stringify(challenge.solution.code).slice(1, -1));
    expect(publicPack).not.toContain(challenge.hints[0].text);
    // The replay case is a deliberately public fixture; its id is named in the pack.
    const isPublic = (item: any) => item.id === challenge.tests.replayCaseId || challenge.tests.run.some((shown: any) => shown.id === item.id);
    for (const hidden of challenge.tests.submit.filter((item: any) => !isPublic(item))) {
      expect(publicPack).not.toContain(`"${hidden.id}"`);
    }
  }

  const session = await request.post("/api/session", { data: { displayName: "Boundary Test" } });
  expect(session.ok()).toBeTruthy();
  await request.put("/api/progress", { data: { progress: { cleared: { [path[0].id]: true }, rewards: { xp: 999999, shards: 99, grants: [] }, savedCode: {} } } });
  const protectedProgress = (await (await request.get("/api/progress")).json()).progress;
  expect(protectedProgress.cleared[path[0].id]).not.toBe(true);
  expect(protectedProgress.rewards.xp).toBe(0);

  const locked = await request.post("/api/run", { data: { source: path[1].solution.code, packSlug: pack.slug, challengeId: path[1].id, mode: "submit" } });
  expect(locked.status()).toBe(409);
  expect((await locked.json()).code).toBe("prerequisite_locked");
  const bad = await request.post("/api/run", { data: { ...run, challengeId: "../../etc/passwd", mode: "submit" } });
  expect(bad.status()).toBe(400);
  // The client can no longer tell the server how much help it used.
  const claimed = await request.post("/api/run", { data: { ...run, mode: "submit", solutionAssisted: false } });
  expect(claimed.status()).toBe(400);

  // Hidden-case errors keep their kind but never echo text produced by the submission.
  const leaky = await request.post("/api/run", { data: { ...run, source: "def count_routes(n):\n    raise ValueError('leak-' + str(n))", mode: "submit" } });
  const leakyPayload = await leaky.json();
  expect(leakyPayload.status).toBe("runtime_error");
  expect(JSON.stringify(leakyPayload.cases)).not.toContain("leak-");

  // Help for a quest the player has not reached is refused.
  const lockedHelp = await request.post("/api/progress", { data: { action: "open_solution", challengeId: path[1].id } });
  expect(lockedHelp.status()).toBe(409);

  // A submission returning a non-finite number is graded, not turned into a gateway error.
  const infinite = await request.post("/api/run", { data: { ...run, source: "def count_routes(n):\n    return float('inf')", mode: "run" } });
  expect(infinite.status()).toBe(200);
  expect((await infinite.json()).status).toBe("wrong_answer");

  const opened = await (await request.post("/api/progress", { data: { action: "open_solution", challengeId: path[0].id } })).json();
  expect(opened.revealed.solutions[path[0].id]).toBe(path[0].solution.code);

  const submit = await request.post("/api/run", { data: { ...run, mode: "submit" } });
  expect(submit.ok()).toBeTruthy();
  const payload = await submit.json();
  expect(payload.cases.every((item: any) => item.caseId.startsWith("hidden-") && item.expected === null && Object.keys(item.arguments).length === 0)).toBeTruthy();
  expect(payload.reward.xp).toBe(13);
  expect(payload.progress.rewards.xp).toBe(13);
  const repeated = await request.post("/api/run", { data: { ...run, mode: "submit" } });
  expect(repeated.ok()).toBeTruthy();
  expect((await repeated.json()).reward).toBeNull();
  expect((await (await request.get("/api/progress")).json()).progress.rewards.xp).toBe(13);
});
