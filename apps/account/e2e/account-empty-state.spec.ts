import { expect, test } from "@playwright/test";
import {
  accountE2eEnabled,
  accountE2eSkipReason,
  expectPageHeading,
  newPersonCredentials,
  signInAccount,
  trackConsoleErrors,
} from "./helpers/account-e2e";

test.describe("Account for a person with no data @journey", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!accountE2eEnabled, accountE2eSkipReason);
    const person = newPersonCredentials();
    test.skip(!person, "ACCOUNT_E2E_EMPTY_EMAIL / _PASSWORD not set");
    if (person) await signInAccount(page, person);
  });

  test("Home invites them to start a collection", async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await expect(page.getByRole("heading", { level: 1, name: /^Welcome/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start your collection" })).toBeVisible();
    await expect(page.getByText(/something went wrong|can't show your works/i)).toHaveCount(0);
    expect(consoleErrors()).toEqual([]);
  });

  test("Portfolio and Money show empty states, not errors", async ({ page }) => {
    await page.goto("/account/portfolio");
    await expectPageHeading(page, "Portfolio");
    await expect(page.getByRole("heading", { name: /appear here/ })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);

    await page.goto("/account/portfolio/money");
    await expectPageHeading(page, "Money");
    await expect(page.getByRole("heading", { name: "No money to show yet" })).toBeVisible();
  });
});
