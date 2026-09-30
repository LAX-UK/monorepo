import { expect, test } from "@playwright/test";
import { signInShopBuyer } from "./helpers/shop-auth";

/** Foundation seed artwork with sellable editions (see shop-api catalogue-seed). */
const ACCEPTANCE_IN_STOCK_SLUG = "harbor-print";

const stripeEnabled = process.env.SHOP_E2E_STRIPE_CHECKOUT === "1";
const stripeSkipReason =
  "Set SHOP_E2E_STRIPE_CHECKOUT=1 with shop-api, shop-identity, Stripe keys, and migration 0181 applied.";

const buyerCredentials = {
  email: process.env.SHOP_E2E_BUYER_EMAIL ?? "user1@lax.bid",
  password: process.env.SHOP_E2E_BUYER_PASSWORD ?? "Password123!",
};

/**
 * Full Stripe checkout (4242) runs only when SHOP_E2E_STRIPE_CHECKOUT=1 against a wired stack.
 * Webhook completion is exercised in shop-api integration tests.
 */
test.describe("shop buyer flow @e2e", () => {
  test("signed-in buyer can complete Stripe test checkout", async ({ page }, testInfo) => {
    test.skip(!stripeEnabled, stripeSkipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "buyer journey on desktop only");

    await signInShopBuyer(page, buyerCredentials, "/checkout");
    await page.goto(`/artworks/${ACCEPTANCE_IN_STOCK_SLUG}`);
    const addButton = page.getByRole("button", { name: /add to basket/i });
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await page.getByRole("link", { name: /view basket/i }).click();
    await page.getByRole("link", { name: /proceed to checkout/i }).click();
    await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();

    await page.getByLabel(/address line 1/i).fill("1 Test Street");
    await page.getByLabel(/city/i).fill("London");
    await page.getByLabel(/postcode/i).fill("W1A 1AA");
    await page.getByRole("button", { name: /continue to payment/i }).click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
    const cardNumber = page
      .frameLocator('iframe[name^="__privateStripeFrame"]')
      .first()
      .getByPlaceholder(/card number|1234/i);
    if (await cardNumber.isVisible().catch(() => false)) {
      await cardNumber.fill("4242424242424242");
    } else {
      await page
        .getByPlaceholder(/card number|1234/i)
        .first()
        .fill("4242424242424242");
    }
    await page
      .getByPlaceholder(/MM \/ YY|expir/i)
      .first()
      .fill("12/34");
    await page
      .getByPlaceholder(/CVC|CVV/i)
      .first()
      .fill("123");
    await page
      .getByRole("button", { name: /pay|submit/i })
      .first()
      .click();

    await page.waitForURL(/\/checkout\/confirmation/, { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: /order confirmation/i })).toBeVisible();

    await page.goto("/account/orders");
    await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
    await expect(page.locator(".shop-order-card, .shop-orders").first()).toBeVisible();
  });

  test("artwork detail exposes basket CTA when stock is listed", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "buyer journey on desktop only");
    await page.goto(`/artworks/${ACCEPTANCE_IN_STOCK_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const addButton = page.getByRole("button", { name: /add to basket/i });
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();
  });

  test("basket route renders", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "buyer journey on desktop only");
    await page.goto("/basket");
    await expect(page.getByRole("heading", { name: "Basket", exact: true })).toBeVisible();
  });

  test("guest can add to basket and see a line on the basket page", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "buyer journey on desktop only");
    await page.goto(`/artworks/${ACCEPTANCE_IN_STOCK_SLUG}`);
    const addButton = page.getByRole("button", { name: /add to basket/i });
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(page.getByRole("link", { name: /view basket/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("link", { name: /view basket/i }).click();
    await expect(page.getByRole("heading", { name: "Basket", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Your basket is empty.")).not.toBeVisible();
    await expect(page.locator(".shop-basket__line").first()).toBeVisible();
  });
});
