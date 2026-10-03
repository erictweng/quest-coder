import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE_URL = "http://localhost:3170";
const pack = JSON.parse(readFileSync("content/server/forest-of-patience-climbing-stairs.json", "utf8"));
const firstQuest = pack.quests[0];

async function signIn(page: Page, name: string) {
  await page.goto("/");
  await expect(page.getByTestId("session-loading")).toHaveCount(0);
  await page.getByLabel("User name").fill(name);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("header").getByText("Signed in as").first()).toContainText(name);
}

async function expectNoViewportOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }))).toEqual(
    expect.objectContaining({ viewport: expect.any(Number), document: expect.any(Number) })
  );
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(widths.document, `document width ${widths.document} exceeded viewport ${widths.viewport}`).toBeLessThanOrEqual(widths.viewport);
}

test("focused signed-in solve flow works without viewport overflow", async ({ page, browser }, testInfo) => {
  const marker = `# personal draft ${testInfo.project.name}`;
  await signIn(page, `Smoke ${testInfo.project.name}`);
  await expectNoViewportOverflow(page);

  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  const editor = page.getByLabel("Python solution editor");
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/progress") && response.request().method() === "PUT" && (response.request().postData() ?? "").includes(marker));
  await editor.fill(marker);
  const saveResponse = await saved;
  expect(saveResponse.status(), await saveResponse.text()).toBe(200);

  await page.reload();
  await expect(page.locator("header").getByText("Signed in as").first()).toContainText(`Smoke ${testInfo.project.name}`);
  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  await expect(editor).toHaveValue(marker);

  await page.getByRole("button", { name: "Open quest notebook" }).click();
  const notebook = page.getByRole("dialog", { name: firstQuest.title });
  await expect(notebook).toBeVisible();
  const questionTab = page.getByRole("tab", { name: "Question" });
  await expect(questionTab).toBeFocused();
  await questionTab.press("Escape");
  await expect(notebook).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open quest notebook" })).toBeFocused();

  await editor.fill(firstQuest.solution.code);
  const runResponse = page.waitForResponse((response) => response.url().endsWith("/api/run") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Run basic" }).click();
  expect((await runResponse).ok()).toBeTruthy();
  await expect(page.getByText("Basic checks passed.")).toBeVisible();
  await expectNoViewportOverflow(page);

  const isolated = await browser.newContext({ baseURL: BASE_URL });
  const isolatedPage = await isolated.newPage();
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("session-loading")).toHaveCount(0);
  await isolatedPage.getByRole("button", { name: "Solve", exact: true }).click();
  await expect(isolatedPage.getByLabel("Python solution editor")).not.toHaveValue(marker);
  expect((await isolatedPage.request.get("/api/progress")).status()).toBe(401);
  await isolated.close();
});
