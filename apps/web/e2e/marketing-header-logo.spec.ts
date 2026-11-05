import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

test.describe("marketing header logo @a11y", () => {
  test("mobile viewport shows a visible compact mark in the header", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/search");
    await page.waitForLoadState("domcontentloaded");

    const logo = page.locator(".site-header-logo img.lax-logo-img").first();
    await expect(logo).toBeVisible();

    // Phones carry the compact mark (32px tall, about 27px wide), not the full lockup.
    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(24);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(28);

    const naturalWidth = await logo.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  });
});
