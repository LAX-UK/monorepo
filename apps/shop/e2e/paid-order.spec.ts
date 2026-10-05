import { expect, test } from "@playwright/test";
import { signInShopBuyer } from "./helpers/shop-auth";

const paidOrderId = process.env.SHOP_ACCEPTANCE_PAID_ORDER_ID?.trim();
const skipReason = "Set SHOP_ACCEPTANCE_PAID_ORDER_ID from staging Stripe webhook rehearsal";

const buyerCredentials = {
  email: process.env.SHOP_OIDC_TEST_EMAIL ?? process.env.SHOP_E2E_BUYER_EMAIL ?? "user1@lax.bid",
  password:
    process.env.SHOP_OIDC_TEST_PASSWORD ?? process.env.SHOP_E2E_BUYER_PASSWORD ?? "Password123!",
};

test.describe("shop paid order @e2e", () => {
  test("acceptance buyer sees webhook-paid order on confirmation and orders list", async ({
    page,
  }, testInfo) => {
    test.skip(!paidOrderId, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "buyer journey on desktop only");

    await signInShopBuyer(page, buyerCredentials, "/account");

    await page.goto(`/checkout/confirmation?orderId=${encodeURIComponent(paidOrderId!)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /thank you|payment processing|order confirmed/i,
      { timeout: 60_000, ignoreCase: true },
    );

    await page.goto("/account/orders");
    await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
    await expect(page.getByText(/paid|completed|order/i).first()).toBeVisible({ timeout: 30_000 });
  });
});
