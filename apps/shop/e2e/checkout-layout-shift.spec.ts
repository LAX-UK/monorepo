import type { Page } from "@playwright/test";
import { signInShopBuyer } from "./helpers/shop-auth";
import { expect, test } from "./helpers/test";

/** Layout shift budget for the signed-in checkout (Core Web Vitals "good"). */
const CLS_BUDGET = 0.1;
const IN_STOCK_SLUG = "harbor-print";
const buyer = {
  email: process.env.SHOP_OIDC_TEST_EMAIL ?? process.env.SHOP_E2E_BUYER_EMAIL ?? "user1@lax.bid",
  password:
    process.env.SHOP_OIDC_TEST_PASSWORD ?? process.env.SHOP_E2E_BUYER_PASSWORD ?? "Password123!",
};

async function ensureBasketHasAPrint(page: Page): Promise<void> {
  await page.goto(`/artworks/${IN_STOCK_SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
  const viewBasket = page.getByRole("link", { name: /view basket/i });
  if (await viewBasket.isVisible().catch(() => false)) return;
  const add = page.getByRole("button", { name: /add to basket/i });
  await expect(add).toBeEnabled({ timeout: 15_000 });
  await add.click();
  await expect(viewBasket).toBeVisible({ timeout: 15_000 });
}

/** Starts recording layout shifts (those not caused by input) before the next document loads. */
async function recordLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { cls: 0 };
    (window as unknown as { __cls: typeof state }).__cls = state;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!entry.hadRecentInput) state.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

test.describe("shop checkout layout shift @e2e", () => {
  for (const viewport of [
    { name: "1440", width: 1440, height: 900 },
    { name: "375", width: 375, height: 812 },
  ]) {
    test(`signed-in checkout stays within ${CLS_BUDGET} CLS at ${viewport.name}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signInShopBuyer(page, buyer, "/account/orders");
      await ensureBasketHasAPrint(page);
      await recordLayoutShifts(page);

      await page.goto("/checkout");
      await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Delivery", exact: true })).toBeVisible();
      await page.waitForLoadState("networkidle");
      // Let late shifts (fonts, images, hydration) land before reading the total.
      await page.waitForTimeout(1_500);

      const cls = await page.evaluate(
        () => (window as unknown as { __cls: { cls: number } }).__cls.cls,
      );
      expect(cls, `CLS was ${cls.toFixed(3)}`).toBeLessThanOrEqual(CLS_BUDGET);
    });
  }
});
