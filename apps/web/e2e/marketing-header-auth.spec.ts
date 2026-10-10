import { type Page, expect, test } from "@playwright/test";
/**
 * E2E test: Marketing header shows authenticated state after client-side navigation.
 */
import { buyerLogin, e2eEnabled, e2eSkipReason } from "./helpers/auth";

const accountMenu = (page: Page) => page.getByRole("button", { name: /account menu/i });
const guestMenu = (page: Page) => page.getByRole("button", { name: "Account", exact: true });

test.describe("marketing header auth @journey", () => {
  test("header shows authenticated state after client navigation to search", async ({ page }) => {
    test.skip(!e2eEnabled, e2eSkipReason);

    await buyerLogin(page);
    await page.goto("/");
    await expect(accountMenu(page)).toBeVisible({ timeout: 10_000 });

    await page
      .getByRole("link", { name: /^search$/i })
      .first()
      .click();
    await page.waitForURL(/\/search/, { timeout: 10_000 });

    await expect(accountMenu(page)).toBeVisible({ timeout: 5_000 });
    await expect(guestMenu(page)).toHaveCount(0);
  });

  test("header updates across tabs on logout", async ({ context }) => {
    test.skip(!e2eEnabled, e2eSkipReason);

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await buyerLogin(page1);
    await page1.goto("/");

    await page2.goto("/");
    await expect(accountMenu(page2)).toBeVisible({ timeout: 10_000 });

    await accountMenu(page1).click();
    await page1.getByRole("menuitem", { name: /log out/i }).click();

    await expect(guestMenu(page2)).toBeVisible({ timeout: 10_000 });
  });

  test("Bid BFF logout ends the session for other tabs on their next load", async ({ context }) => {
    test.skip(!e2eEnabled, e2eSkipReason);

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await buyerLogin(page1);

    await page2.goto("/");
    await expect(accountMenu(page2)).toBeVisible({ timeout: 10_000 });

    await page1.evaluate(async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    });

    await page2.reload();
    await expect(guestMenu(page2)).toBeVisible({ timeout: 10_000 });
  });
});
