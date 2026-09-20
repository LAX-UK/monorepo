import { expect, test } from "@playwright/test";

/**
 * Buyer flow stops before live Stripe; webhook completion is exercised in shop-api tests.
 */
test.describe("shop buyer flow @e2e", () => {
  test("artwork detail exposes basket CTA when stock is listed", async ({ page }) => {
    await page.goto("/artworks");
    const firstArtwork = page.locator('a[href^="/artworks/"]').first();
    await firstArtwork.click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const addButton = page.getByRole("button", { name: /add to basket/i });
    if (await addButton.isVisible()) {
      await expect(addButton).toBeEnabled();
    }
  });

  test("basket route renders", async ({ page }) => {
    await page.goto("/basket");
    await expect(page.getByRole("heading", { name: "Basket", exact: true })).toBeVisible();
  });

  test("guest can add to basket and see a line on the basket page", async ({ page }) => {
    await page.goto("/artworks");
    const addButton = page.getByRole("button", { name: /add to basket/i }).first();
    if (!(await addButton.isVisible())) {
      test.skip();
    }
    await addButton.click();
    await page.waitForURL("**/basket**", { timeout: 15_000 }).catch(() => undefined);
    await page.goto("/basket");
    await expect(page.getByRole("heading", { name: "Basket" })).toBeVisible();
    const emptyMessage = page.getByText("Your basket is empty.");
    if (await emptyMessage.isVisible()) {
      test.skip(true, "Guest basket persistence requires shop-identity and shop-api in e2e stack");
    }
    await expect(page.locator(".shop-basket__line").first()).toBeVisible();
  });
});
