import { expect, test } from "@playwright/test";
import { signInShopBuyer, signOutShopBuyer } from "./helpers/shop-auth";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1 against a wired Shop + shop-identity + auth stack.";

const buyerCredentials = {
  email: process.env.SHOP_E2E_BUYER_EMAIL ?? process.env.SHOP_OIDC_TEST_EMAIL ?? "user1@lax.bid",
  password:
    process.env.SHOP_E2E_BUYER_PASSWORD ?? process.env.SHOP_OIDC_TEST_PASSWORD ?? "Password123!",
};

test.describe("shop first login @e2e", () => {
  test("password sign-in reaches returnTo without sign-in-error", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "buyer journey on desktop only");
    test.setTimeout(90_000);

    await page.context().clearCookies();
    await signInShopBuyer(page, buyerCredentials, "/basket");
    expect(page.url()).not.toMatch(/\/sign-in-error/);
    await expect(page.getByRole("heading", { name: "Basket", exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("sign-in immediately after sign-out does not hit sign-in-error", async ({
    page,
  }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "buyer journey on desktop only");
    test.setTimeout(120_000);

    await signInShopBuyer(page, buyerCredentials, "/account");
    await signOutShopBuyer(page);
    await signInShopBuyer(page, buyerCredentials, "/basket");
    expect(page.url()).not.toMatch(/\/sign-in-error/);
    await expect(page.getByRole("heading", { name: "Basket", exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });
});
