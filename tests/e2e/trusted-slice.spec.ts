import { expect, request as playwrightRequest, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const pack = JSON.parse(readFileSync("content/server/forest-of-patience-climbing-stairs.json", "utf8"));
const path = [...pack.quests, pack.boss];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function signIn(page: Page, name: string) {
  await page.goto("/");
  await expect(page.getByTestId("session-loading")).toHaveCount(0);
  await page.getByLabel("User name").fill(name);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Signed in as")).toContainText(name);
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
  // The page saves once right after sign-in; let that land before seeding, or it would overwrite the seed.
  const firstSave = page.waitForResponse((response) => response.url().endsWith("/api/progress") && response.request().method() === "PUT");
  await signIn(page, "Draft Ranger");
  await firstSave;
  // Give the save file large drafts for the other quests, so every save from here on is bigger
  // than browsers allow for keepalive requests. Ordinary saves must still go through.
  const padding = "# a long comment line that pads this draft out\n".repeat(480);
  const seeded = await context.request.put("/api/progress", { data: { progress: { savedCode: Object.fromEntries(path.slice(1).map((challenge: any) => [challenge.id, padding])) } } });
  expect(seeded.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByText("Signed in as")).toContainText("Draft Ranger");
  await page.getByRole("button", { name: "Continue Last Quest" }).click();

  const draft = "def count_routes(n):\n    return 1  # my draft";
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/progress") && response.request().method() === "PUT" && (response.request().postData() ?? "").includes("my draft"));
  await setCode(page, draft);
  const save = await saved;
  expect(save.ok()).toBeTruthy();
  expect((save.request().postData() ?? "").length).toBeGreaterThan(64_000);
  await page.reload();
  await expect(page.getByText("Signed in as")).toContainText("Draft Ranger");
  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  await expect(page.getByLabel("Python solution editor")).toHaveValue(draft);
  // Give the autosave a chance to (wrongly) write starter code back, then check the server copy.
  await page.waitForTimeout(1_000);
  expect((await (await context.request.get("/api/progress")).json()).progress.savedCode[path[0].id]).toBe(draft);

  // The run shortcut cannot start a second run while one is in flight.
  let runRequests = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/run")) runRequests += 1; });
  const editor = page.getByLabel("Python solution editor");
  await editor.focus();
  await editor.press("ControlOrMeta+Enter");
  await editor.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("result-summary")).toBeVisible();
  expect(runRequests).toBe(1);

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
  await expect(page.getByTestId("completion-floating-panel")).toHaveCount(0);
  await expect(page.getByText("Previous run.")).toBeVisible();
  await page.getByRole("button", { name: "View Animation" }).click();
  await expect(page.getByText("Line movement").locator("..")).toContainText("count_routes");
  await expect(page.getByText("Line movement").locator("..")).not.toContainText("edited after the run");
});

test("delayed initial progress cannot replace code typed while the save loads", async ({ page, context }) => {
  expect((await context.request.post("/api/session", { data: { displayName: "Loading Ranger" } })).ok()).toBeTruthy();
  await context.request.put("/api/progress", { data: { progress: { savedCode: { [path[0].id]: "# server draft" }, savedCodeVersions: { [path[0].id]: 0 } } } });
  const gate = deferred();
  const fetched = deferred();
  await page.route("**/api/progress", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    fetched.resolve();
    await gate.promise;
    await route.fulfill({ response });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Solve", exact: true }).click();
  await setCode(page, "# typed while loading");
  await fetched.promise;
  gate.resolve();
  await expect(page.getByTestId("session-loading")).toHaveCount(0);
  await expect(page.getByLabel("Python solution editor")).toHaveValue("# typed while loading");
});

test("delayed hint cannot roll back a newer submit and delayed submit cannot survive logout", async ({ page }) => {
  await signIn(page, "Race Ranger");
  await page.getByRole("button", { name: "Continue Last Quest" }).click();

  const hintGate = deferred();
  const hintFetched = deferred();
  await page.route("**/api/progress", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    hintFetched.resolve();
    await hintGate.promise;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: /quest notebook/i }).click();
  await page.getByRole("tab", { name: "Hints" }).click();
  await page.getByRole("button", { name: "Reveal a hint" }).click();
  await hintFetched.promise;
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await setCode(page, path[0].solution.code);
  await page.getByRole("button", { name: "Submit all" }).click();
  await expect(page.getByTestId("completion-floating-panel")).toBeVisible();
  hintGate.resolve();
  await expect(page.getByTestId("completion-floating-panel")).toBeVisible();
  await expect(page.getByTestId("completion-floating-panel")).toContainText("+25 XP");
  await page.unroute("**/api/progress");

  await page.getByRole("button", { name: "Move to next quest" }).click();
  await setCode(page, path[1].solution.code);
  const runGate = deferred();
  const runFetched = deferred();
  await page.route("**/api/run", async (route) => {
    const response = await route.fetch();
    runFetched.resolve();
    await runGate.promise;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Submit all" }).click();
  await runFetched.promise;
  await page.getByRole("button", { name: "Log out" }).click();
  runGate.resolve();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByTestId("completion-floating-panel")).toHaveCount(0);
  await expect(page.getByText("Race Ranger")).toHaveCount(0);
});

test("401 cleanup removes profile, help, result, reward and attempt state", async ({ page }) => {
  await signIn(page, "Expired Ranger");
  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  await setCode(page, path[0].solution.code);
  await page.getByRole("button", { name: "Submit all" }).click();
  await expect(page.getByTestId("completion-floating-panel")).toBeVisible();
  await setCode(page, "# invalidate old pass");
  await page.route("**/api/progress", (route) => route.request().method() === "POST"
    ? route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthorized" }) })
    : route.continue());
  await page.getByRole("button", { name: /quest notebook/i }).click();
  await page.getByRole("tab", { name: "Hints" }).click();
  await page.getByRole("button", { name: "Reveal a hint" }).click();
  await expect(page.getByText("Your session ended. Sign in again to keep going.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("completion-floating-panel")).toHaveCount(0);
  await expect(page.getByText("Expired Ranger")).toHaveCount(0);
  // Earned XP is gone. (Quest notices legitimately show fixed reward labels such as "25 XP" and "125 XP".)
  await expect(page.getByText(/\+25 XP/)).toHaveCount(0);
  await expect(page.getByText("25 XP total")).toHaveCount(0);
  await expect(page.getByTestId("character-sheet")).toContainText("0 XP total");
});

test("non-JSON gateway failures show retry guidance instead of parser errors", async ({ page }) => {
  await signIn(page, "Gateway Ranger");
  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  await page.route("**/api/run", (route) => route.fulfill({ status: 502, contentType: "text/html", body: "<html>bad gateway</html>" }));
  await page.getByRole("button", { name: "Run basic" }).click();
  await expect(page.getByText("The runner returned an unreadable response. Retry in a moment.")).toBeVisible();
  await expect(page.getByText(/Unexpected token|JSON/i)).toHaveCount(0);
  await page.unroute("**/api/run");
  await page.route("**/api/run", (route) => route.fulfill({ status: 503, body: "" }));
  await page.getByRole("button", { name: "Run basic" }).click();
  await expect(page.getByText("The runner returned an unreadable response. Retry in a moment.")).toBeVisible();
});

test("last quest resumes after reload and assisted completion is labeled", async ({ page }) => {
  await signIn(page, "Resume Ranger");
  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  await submitAndAdvance(page, path[0]);
  await expect(page.getByRole("heading", { name: path[1].title })).toBeVisible();
  await expect.poll(async () => (await (await page.request.get("/api/progress")).json()).progress.lastChallengeId).toBe(path[1].id);
  await page.getByRole("button", { name: "Home" }).click();
  await page.reload();
  await expect(page.getByText("Signed in as")).toContainText("Resume Ranger");
  await expect(page.getByRole("button", { name: "Continue Last Quest" })).toContainText(path[1].title);
  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  await expect(page.getByRole("heading", { name: path[1].title })).toBeVisible();

  await page.getByRole("button", { name: /quest notebook/i }).click();
  await page.getByRole("tab", { name: "Solution" }).click();
  await page.getByRole("button", { name: "I want to view the solution" }).click();
  await page.getByRole("button", { name: "Reveal solution" }).click();
  await expect(page.getByText(/Solution revealed/)).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await setCode(page, path[1].solution.code);
  await page.getByRole("button", { name: "Submit all" }).click();
  await expect(page.getByTestId("completion-floating-panel")).toContainText("Solution-assisted clear.");
});

test("Quest Notebook behaves as a keyboard-contained modal tab interface", async ({ page }) => {
  await signIn(page, "Keyboard Ranger");
  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  const toggle = page.getByRole("button", { name: "Open quest notebook" });
  await toggle.focus();
  await toggle.press("Enter");
  const dialog = page.getByRole("dialog", { name: path[0].title });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(page.locator('section[aria-label="Code editor"]')).toHaveAttribute("inert", "");
  const question = page.getByRole("tab", { name: "Question" });
  await expect(question).toBeFocused();
  await question.press("ArrowRight");
  const animation = page.getByRole("tab", { name: "Animation" });
  await expect(animation).toBeFocused();
  await expect(animation).toHaveAttribute("aria-selected", "true");
  for (let index = 0; index < 12; index += 1) await page.keyboard.press("Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open quest notebook" })).toBeFocused();
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
    expect(challenge.tests.submit).toBeUndefined();
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

test("Google sign-in is hidden and fails closed without Supabase, and auth errors are shown once", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("session-loading")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in with Google" })).toHaveCount(0);

  await page.goto("/auth/google");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Google sign-in is not available on this server.")).toBeVisible();

  await page.goto("/auth/callback?error=access_denied&error_description=cancelled");
  await expect(page.getByText("Google sign-in was cancelled.")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  await page.reload();
  await expect(page.getByText("Google sign-in was cancelled.")).toHaveCount(0);
});

test("Supabase mode offers only Sign in with Google, with no email form", async ({ page }) => {
  await page.route("**/api/session", (route) => route.request().method() === "GET"
    ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: false, provider: "supabase" }) })
    : route.continue());
  await page.goto("/");
  await expect(page.getByTestId("session-loading")).toHaveCount(0);
  const google = page.getByRole("link", { name: "Sign in with Google" });
  await expect(google).toHaveCount(1);
  await expect(google).toHaveAttribute("href", "/auth/google");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Solve", exact: true }).click();
  await expect(page.getByRole("link", { name: "Sign in with Google" })).toHaveCount(1);
  await expect(page.getByTestId("signed-out-prompt")).toContainText("Sign in with Google");
});

test("app JSON endpoints reject oversized bodies", async ({ request }) => {
  const session = await request.post("/api/session", { data: { displayName: "Size Boundary" } });
  expect(session.ok()).toBeTruthy();
  const oversizedRun = await request.post("/api/run", {
    headers: { "content-type": "application/json" },
    data: JSON.stringify({ source: "x".repeat(30_000), packSlug: pack.slug, challengeId: path[0].id, mode: "run" })
  });
  expect(oversizedRun.status()).toBe(413);
  const oversizedProgress = await request.put("/api/progress", {
    headers: { "content-type": "application/json" },
    data: JSON.stringify({ progress: { savedCode: { huge: "x".repeat(1_000_100) } } })
  });
  expect(oversizedProgress.status()).toBe(413);
});

test("the design style tile is not served by the production build", async ({ page }) => {
  const response = await page.goto("/styleguide");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Quest Coder", level: 1 })).toHaveCount(0);
});

test("town hub: notices open quests, locks are explained, and the character sheet levels up", async ({ page }) => {
  await signIn(page, "Hub Ranger");
  const sheet = page.getByTestId("character-sheet");
  await expect(sheet).toContainText("Level 1 · Squire");
  await expect(sheet).toContainText("0/1 bosses defeated");

  const board = page.getByRole("region", { name: "Quest board" });
  const map = page.getByRole("region", { name: "World map" });
  // Quest 2 and the boss are locked, show the word "Locked" and explain why.
  await expect(board.getByRole("button", { name: new RegExp(path[1].title) })).toBeDisabled();
  await expect(board.getByRole("button", { name: new RegExp(path[1].title) })).toContainText("Locked");
  await expect(board.getByRole("button", { name: /Boss encounter/ })).toBeDisabled();
  await expect(board.getByRole("button", { name: /Boss encounter/ })).toContainText("Clear all 3 quests to open the gate");
  await expect(map.getByRole("button", { name: `${pack.boss.title}: boss gate locked` })).toBeDisabled();

  // The available notice opens its quest; clearing it unlocks the next notice and adds XP.
  await board.getByRole("button", { name: new RegExp(path[0].title) }).click();
  await expect(page.getByRole("heading", { name: path[0].title })).toBeVisible();
  await submitAndAdvance(page, path[0]);
  await page.getByRole("button", { name: "Home" }).click();
  await expect(board.getByRole("button", { name: new RegExp(path[0].title) })).toContainText("Cleared");
  await expect(board.getByRole("button", { name: new RegExp(path[1].title) })).toBeEnabled();
  await expect(sheet).toContainText(`${path[0].rewards.xp} XP total`);

  // The map's region node opens the region page.
  await map.getByRole("button", { name: new RegExp(pack.title) }).click();
  await expect(page.getByRole("button", { name: "Back to campaigns" })).toBeVisible();
});
