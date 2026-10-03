import { expect, test } from "@playwright/test";
import { signInShopBuyer } from "./helpers/shop-auth";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const isCi = process.env.CI === "true";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and seed the Shop catalogue (harbor-print).";

const FIXTURE_SLUG = "harbor-print";

function requireGuestBasketE2e(): void {
  if (enabled) return;
  const message = `${skipReason} PLAYWRIGHT_E2E is not set.`;
  if (isCi) throw new Error(message);
  test.skip(true, message);
}

function requireShopBuyerCredentials(): { email: string; password: string } {
  const email = process.env.SHOP_OIDC_TEST_EMAIL;
  const password = process.env.SHOP_OIDC_TEST_PASSWORD;
  if (email && password) {
    return { email, password };
  }
  const message = `${skipReason} Provide SHOP_OIDC_TEST_EMAIL and SHOP_OIDC_TEST_PASSWORD.`;
  if (isCi) throw new Error(message);
  test.skip(true, message);
}

test.describe("Shop guest basket @e2e", () => {
  test("guest can remove a basket line", async ({ page }, testInfo) => {
    requireGuestBasketE2e();
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop basket controls only");

    await page.goto(`/artworks/${FIXTURE_SLUG}`);
    const addButton = page.getByRole("button", { name: /add to basket/i });
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(page.getByRole("link", { name: /view basket/i })).toBeVisible({ timeout: 15_000 });

    await page.goto("/basket");
    await expect(page.getByRole("heading", { name: "Basket", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).first().click();
    await expect(page.getByRole("heading", { name: "Your basket is empty" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("guest basket merges after sign-in", async ({ page }, testInfo) => {
    requireGuestBasketE2e();
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop basket controls only");
    const credentials = requireShopBuyerCredentials();

    await page.context().clearCookies();
    await page.goto(`/artworks/${FIXTURE_SLUG}`);
    const addButton = page.getByRole("button", { name: /add to basket/i });
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(page.getByRole("link", { name: /view basket/i })).toBeVisible({ timeout: 15_000 });

    await signInShopBuyer(page, credentials, "/basket");
    await expect(page.getByRole("heading", { name: "Basket", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your basket is empty" })).not.toBeVisible();
    await expect(page.locator(".shop-basket__line").first()).toBeVisible();
  });

  test("guest can increase basket quantity when stock allows", async ({ page }, testInfo) => {
    requireGuestBasketE2e();
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop basket controls only");

    await page.goto(`/artworks/${FIXTURE_SLUG}`);
    const addButton = page.getByRole("button", { name: /add to basket/i });
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(page.getByRole("link", { name: /view basket/i })).toBeVisible({ timeout: 15_000 });

    await page.goto("/basket");
    await expect(page.locator(".shop-basket__line").first()).toBeVisible();

    const increase = page.getByRole("button", { name: /Increase quantity/i }).first();
    if (!(await increase.isEnabled())) {
      test.skip(true, "harbor-print has a single sellable edition in this environment");
    }
    await increase.click();
    await expect(page.locator(".shop-basket__line").first()).toContainText("2");
  });
});
