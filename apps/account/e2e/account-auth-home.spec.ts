import { expect, test } from "@playwright/test";
import { accountAuthState, signedOutState } from "./helpers/account-auth-state";
import {
  accountE2eEnabled,
  accountE2eSkipReason,
  collectorSkipReason,
  expectPageHeading,
} from "./helpers/account-e2e";

test.describe("Account sign-in @smoke", () => {
  test.skip(!accountE2eEnabled, accountE2eSkipReason);
  test.use({ storageState: signedOutState });

  test("signed out, /account sends the person to sign-in", async ({ page }) => {
    const authorize = page.waitForRequest(
      (request) => new URL(request.url()).pathname.endsWith("/oauth2/authorize"),
      { timeout: 45_000 },
    );
    await page.goto("/account");
    const url = new URL((await authorize).url());
    expect(url.searchParams.get("client_id")).toBe("lax-account-web");
  });
});

const skipReason = collectorSkipReason();

test.describe("Account Home for the demo collector @journey", () => {
  test.skip(skipReason !== null, skipReason ?? "");
  test.use({ storageState: accountAuthState.collector });

  test.beforeEach(async ({ page }) => {
    await page.goto("/account");
  });

  test("greets the collector by name on Home", async ({ page }) => {
    await expectPageHeading(page, /^Welcome, \S+/);
    await expect(page).toHaveURL(/\/account$/);
  });

  test("shows Needs you, the collection, works by product, product cards and the checkup", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "Needs you" })).toBeVisible();

    const collection = page.getByRole("region", { name: "Your collection" });
    await expect(collection).toBeVisible();
    // Counts come from seed data that can drift, so only require that numbers are present.
    await expect(collection.locator("dd").filter({ hasText: /^\d+$/ }).first()).toBeVisible();
    await expect(collection.getByRole("heading", { name: "Works by product" })).toBeVisible();

    const products = page.getByRole("region", { name: "Your LAX products" });
    for (const name of ["LAX Bid", "LAX Shop", "lax.art"]) {
      await expect(products.getByRole("link", { name: `Open ${name}` })).toBeVisible();
    }
    // The collector holds Bid works, so the Bid card carries a count of them.
    await expect(products.getByRole("listitem").filter({ hasText: /\d/ }).first()).toBeVisible();

    await expect(page.getByRole("heading", { name: /security checkup/i })).toBeVisible();
  });
});
