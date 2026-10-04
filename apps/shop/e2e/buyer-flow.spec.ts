import { type Page, expect, test } from "@playwright/test";
import { signInShopBuyer } from "./helpers/shop-auth";

/** Foundation seed artwork with sellable editions (see shop-api catalogue-seed). */
const ACCEPTANCE_IN_STOCK_SLUG = "harbor-print";
const ACCEPTANCE_STRIPE_CHECKOUT_SLUG =
  process.env.SHOP_ACCEPTANCE_STRIPE_CHECKOUT_SLUG ?? "acceptance-stripe-print";

const stripeEnabled = process.env.SHOP_E2E_STRIPE_CHECKOUT === "1";
const stripeSkipReason =
  "Set SHOP_E2E_STRIPE_CHECKOUT=1 with shop-api, shop-identity, Stripe keys, and migration 0181 applied.";

const buyerCredentials = {
  email: process.env.SHOP_OIDC_TEST_EMAIL ?? process.env.SHOP_E2E_BUYER_EMAIL ?? "user1@lax.bid",
  password:
    process.env.SHOP_OIDC_TEST_PASSWORD ?? process.env.SHOP_E2E_BUYER_PASSWORD ?? "Password123!",
};

/**
 * Full Stripe checkout (4242) runs only when SHOP_E2E_STRIPE_CHECKOUT=1 against a wired stack.
 * Webhook completion is exercised in shop-api integration tests.
 */
async function ensureAcceptanceStripePrintInBasket(page: Page): Promise<void> {
  await page.goto(`/artworks/${ACCEPTANCE_STRIPE_CHECKOUT_SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
  const viewBasket = page.getByRole("link", { name: /view basket/i });
  if (await viewBasket.isVisible().catch(() => false)) {
    return;
  }
  const addButton = page.getByRole("button", { name: /add to basket/i });
  await expect(addButton).toBeEnabled({ timeout: 15_000 });
  await addButton.click();
  await expect(viewBasket).toBeVisible({ timeout: 15_000 });
}

/** Stripe Hosted Checkout (redirect) — card fields vary by layout (iframe vs direct). */
async function submitStripeHostedTestPayment(page: Page): Promise<void> {
  await page.waitForURL(/checkout\.stripe\.com/i, { timeout: 90_000 });

  const payWithCard = page.getByRole("button", { name: /pay with card|card/i });
  if (await payWithCard.isVisible().catch(() => false)) {
    await payWithCard.click();
  }

  const directCard = page
    .locator('input[autocomplete="cc-number"], input[name="cardnumber"]')
    .first();
  if (await directCard.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await directCard.fill("4242424242424242");
    await page
      .locator('input[autocomplete="cc-exp"], input[name="exp-date"]')
      .first()
      .fill("12/34");
    await page.locator('input[autocomplete="cc-csc"], input[name="cvc"]').first().fill("123");
  } else {
    const cardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    const cardNumber = cardFrame.getByPlaceholder(/card number|1234/i);
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
  }

  const payButton = page.getByRole("button", { name: /^pay$/i });
  if (await payButton.isVisible().catch(() => false)) {
    await payButton.click();
  } else {
    await page
      .getByRole("button", { name: /pay|submit/i })
      .first()
      .click();
  }
}

test.describe("shop buyer flow @e2e", () => {
  test.describe("Stripe checkout (staging)", () => {
    test.describe.configure({ retries: 0 });

    test("signed-in buyer can complete Stripe test checkout", async ({ page }, testInfo) => {
      test.skip(!stripeEnabled, stripeSkipReason);
      test.skip(testInfo.project.name !== "chromium-desktop", "buyer journey on desktop only");
      test.setTimeout(420_000);

      await signInShopBuyer(page, buyerCredentials, "/account");
      await ensureAcceptanceStripePrintInBasket(page);
      await page.getByRole("link", { name: /view basket/i }).click();
      await page.getByRole("link", { name: /proceed to checkout/i }).click();
      await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
      await page.waitForLoadState("networkidle");

      await page.getByLabel(/address line 1/i).fill("1 Test Street");
      await page.getByLabel(/city/i).fill("London");
      await page.getByLabel(/postcode/i).fill("W1A 1AA");
      await expect(page.getByRole("button", { name: /continue to payment/i })).toBeEnabled();
      await page.getByRole("button", { name: /continue to payment/i }).click();

      await expect
        .poll(
          async () => {
            const url = page.url();
            if (/checkout\.stripe\.com/i.test(url)) return "stripe";
            if (url.includes("country=GB")) return "native-submit";
            if (
              await page
                .getByText("Checkout could not continue")
                .isVisible()
                .catch(() => false)
            ) {
              return "error";
            }
            if (
              await page
                .getByRole("button", { name: /redirecting to secure payment|starting payment/i })
                .isVisible()
                .catch(() => false)
            ) {
              return "pending";
            }
            return "waiting";
          },
          { timeout: 90_000 },
        )
        .not.toBe("native-submit");

      const stripeNavigation = page.waitForURL(/checkout\.stripe\.com/, { timeout: 90_000 });
      const checkoutFailed = page
        .getByText("Checkout could not continue")
        .waitFor({ state: "visible", timeout: 90_000 })
        .then(async () => {
          const alert = page.locator(".shop-checkout__form [role='alert']").first();
          const message =
            (await alert.textContent().catch(() => null)) ??
            (await page
              .locator(".shop-checkout__form p")
              .last()
              .textContent()
              .catch(() => null));
          throw new Error(`Checkout failed: ${message?.trim() ?? "Checkout could not continue"}`);
        });
      await Promise.race([stripeNavigation, checkoutFailed]);

      await submitStripeHostedTestPayment(page);

      await page.waitForURL(/test-shop\.lax\.bid\/checkout\/confirmation/i, { timeout: 180_000 });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        /thank you|payment processing/i,
        { timeout: 120_000, ignoreCase: true },
      );

      await expect
        .poll(
          async () => {
            await page.goto("/account/orders");
            await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
            return page
              .getByText(/paid|completed|order/i)
              .first()
              .isVisible()
              .catch(() => false);
          },
          { timeout: 120_000 },
        )
        .toBe(true);
    });
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
    const addError = page.getByRole("alert");
    await expect
      .poll(
        async () => {
          if (await page.getByRole("link", { name: /view basket/i }).isVisible()) {
            return "ok";
          }
          if (await addError.isVisible()) {
            return (await addError.textContent()) ?? "add failed";
          }
          return "pending";
        },
        { timeout: 15_000 },
      )
      .toBe("ok");
    await page.getByRole("link", { name: /view basket/i }).click();
    await expect(page.getByRole("heading", { name: "Basket", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Your basket is empty" })).not.toBeVisible();
    await expect(page.locator(".shop-basket__line").first()).toBeVisible();
  });
});
