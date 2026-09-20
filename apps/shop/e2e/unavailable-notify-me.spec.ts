import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1 and start Shop, shop-identity, auth, and seeded catalogue.";

async function signInToShop(page: import("@playwright/test").Page, returnTo: string) {
  const email = process.env.SHOP_OIDC_TEST_EMAIL;
  const password = process.env.SHOP_OIDC_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("SHOP_OIDC_TEST_EMAIL and SHOP_OIDC_TEST_PASSWORD are required");
  }
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test.describe("unavailable artwork interest @e2e", () => {
  test("authenticated viewer sees notify-me on sold-out editions", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await signInToShop(page, "/artworks/reed-study");
    await expect(page).toHaveURL(/\/artworks\/reed-study/, { timeout: 60_000 });

    await expect(page.getByRole("button", { name: "Notify me" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create a LAX account" })).toHaveCount(0);
  });

  test("authenticated viewer can register interest on price-on-request originals", async ({
    page,
  }) => {
    test.skip(!enabled, skipReason);
    await signInToShop(page, "/artworks/string-study");
    await expect(page).toHaveURL(/\/artworks\/string-study/, { timeout: 60_000 });

    await page.getByRole("button", { name: "Register interest" }).click();
    await expect(page.getByRole("button", { name: "Interest registered" })).toBeVisible({
      timeout: 30_000,
    });

    await page.reload();
    await expect(page.getByRole("button", { name: "Interest registered" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
