import { expect, test } from "@playwright/test";

/** Foundation seed artwork with sellable editions (see shop-api catalogue-seed). */
const ACCEPTANCE_IN_STOCK_SLUG = "harbor-print";

/**
 * Buyer flow stops before live Stripe; webhook completion is exercised in shop-api tests.
 */
test.describe("shop buyer flow @e2e", () => {
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
    await page.waitForURL("**/basket**", { timeout: 15_000 }).catch(() => undefined);
    await page.goto("/basket");
    await expect(page.getByRole("heading", { name: "Basket" })).toBeVisible();
    await expect(page.getByText("Your basket is empty.")).not.toBeVisible();
    await expect(page.locator(".shop-basket__line").first()).toBeVisible();
  });
});
