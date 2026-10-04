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
 * Staging runs SHOP_E2E_STRIPE_CHECKOUT=1 to assert redirect to Stripe Hosted Checkout only.
 * Payment completion is rehearsed via signed webhook on staging (shop-api script + integration tests).
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

test.describe("shop buyer flow @e2e", () => {
  test.describe("Stripe checkout (staging)", () => {
    test.describe.configure({ retries: 0 });

    test("signed-in buyer reaches Stripe hosted checkout (staging)", async ({ page }, testInfo) => {
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
      await expect(page).toHaveURL(/checkout\.stripe\.com/i);
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
