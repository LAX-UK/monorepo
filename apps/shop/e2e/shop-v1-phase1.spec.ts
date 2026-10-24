import { expect, test } from "@playwright/test";
import { signInShopBuyer } from "./helpers/shop-auth";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const isCi = process.env.CI === "true";
const skipReason =
  "Set PLAYWRIGHT_E2E=1 and PLAYWRIGHT_BASE_URL (Shop storefront) for phase 1 smoke.";

const portalFailureTitles = ["Orders unavailable", "Orders temporarily unavailable"] as const;

function requirePhase1E2e(): void {
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

test.describe("Shop V1 phase 1 smoke", () => {
  test.setTimeout(120_000);

  test("the account area is Your orders, and retired tabs leave Shop", async ({ page }) => {
    requirePhase1E2e();
    const { email, password } = requireShopBuyerCredentials();

    await signInShopBuyer(page, { email, password }, "/account/orders");
    await expect(page).toHaveURL(/\/account\/orders(\?.*)?$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/your orders/i);
    for (const title of portalFailureTitles) {
      await expect(page.getByText(title, { exact: true })).not.toBeVisible();
    }

    for (const path of ["/account/collection", "/account/editions", "/account/documents"]) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(308);
      expect(response.headers().location).toMatch(/\/account\/portfolio/);
    }
  });

  test("seller tools leave Shop for LAX Account's Selling area", async ({ page }) => {
    requirePhase1E2e();
    const moved: Array<[string, RegExp]> = [
      ["/account/sale-limits", /\/account\/selling\/editions$/],
      ["/account/sales", /\/account\/selling\/sales$/],
      ["/account/payouts", /\/account\/selling\/payouts$/],
      ["/account/artworks", /\/account\/selling\/artworks$/],
      ["/account/artist-sales", /\/account\/selling\/artworks$/],
    ];
    for (const [path, destination] of moved) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(308);
      expect(response.headers().location).toMatch(destination);
    }
  });
});
