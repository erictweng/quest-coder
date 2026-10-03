import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessible(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations, `${context}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
}

async function signIn(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("session-loading")).toHaveCount(0);
  await page.getByLabel("User name").fill("Accessibility Ranger");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Signed in as")).toContainText("Accessibility Ranger");
}

test("hub has no WCAG A/AA axe violations", async ({ page }) => {
  await signIn(page);
  await expectAccessible(page, "signed-in hub");
});

test("solve screen and open Quest Notebook have no WCAG A/AA axe violations", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Continue Last Quest" }).click();
  await expectAccessible(page, "solve screen");
  await page.getByRole("button", { name: "Open quest notebook" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectAccessible(page, "open Quest Notebook");
});
