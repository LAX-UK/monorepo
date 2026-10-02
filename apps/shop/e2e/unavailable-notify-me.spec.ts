import { expect, test } from "@playwright/test";
import { signInShopBuyer } from "./helpers/shop-auth";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1 and start Shop, shop-identity, auth, and seeded catalogue.";

function requireShopCredentials(): { email: string; password: string } {
  const email = process.env.SHOP_OIDC_TEST_EMAIL;
  const password = process.env.SHOP_OIDC_TEST_PASSWORD;
  if (email && password) {
    return { email, password };
  }
  throw new Error(`${skipReason} Provide SHOP_OIDC_TEST_EMAIL and SHOP_OIDC_TEST_PASSWORD.`);
}

test.describe("unavailable artwork interest @e2e", () => {
  test("authenticated viewer sees notify-me on sold-out editions", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "authenticated journey on desktop only",
    );
    const credentials = requireShopCredentials();
    await signInShopBuyer(page, credentials, "/artworks/reed-study");
    await expect(page).toHaveURL(/\/artworks\/reed-study/, { timeout: 60_000 });

    await expect(page.getByRole("button", { name: "Notify me" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create a LAX account" })).toHaveCount(0);
  });

  test("authenticated viewer can register interest on price-on-request originals", async ({
    page,
  }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "authenticated journey on desktop only",
    );
    const credentials = requireShopCredentials();
    await signInShopBuyer(page, credentials, "/artworks/string-study");
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
