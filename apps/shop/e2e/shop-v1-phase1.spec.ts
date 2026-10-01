import { expect, test } from "@playwright/test";
import { signInShopBuyer } from "./helpers/shop-auth";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1 and PLAYWRIGHT_BASE_URL (Shop storefront) for phase 1 smoke.";

const portalFailureTitles = [
  "Ownership portal not enabled",
  "Could not load editions",
  "Could not load sale limits",
] as const;

function requireShopBuyerCredentials(): { email: string; password: string } {
  const email = process.env.SHOP_OIDC_TEST_EMAIL;
  const password = process.env.SHOP_OIDC_TEST_PASSWORD;
  test.skip(
    !email || !password,
    `${skipReason} Provide SHOP_OIDC_TEST_EMAIL and SHOP_OIDC_TEST_PASSWORD.`,
  );
  return { email: email as string, password: password as string };
}

test.describe("Shop V1 phase 1 smoke", () => {
  test.setTimeout(120_000);

  test("signed-in account portal pages load without error notice", async ({ page }) => {
    test.skip(!enabled, skipReason);
    const { email, password } = requireShopBuyerCredentials();

    await signInShopBuyer(page, { email, password }, "/account");
    for (const path of ["/account/editions", "/account/sale-limits"]) {
      await page.goto(path);
      await expect(page.locator("#main-content")).toBeVisible();
      for (const title of portalFailureTitles) {
        await expect(page.getByText(title, { exact: true })).not.toBeVisible();
      }
    }
  });

  test("account hub exposes ownership entry points", async ({ page }) => {
    test.skip(!enabled, skipReason);
    const { email, password } = requireShopBuyerCredentials();

    await signInShopBuyer(page, { email, password }, "/account");
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.getByRole("link", { name: /my editions/i })).toBeVisible();
  });
});
