import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

test.describe("marketing header logo @smoke", () => {
  test("mobile viewport shows a visible full logo in the header", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/search");
    await page.waitForLoadState("domcontentloaded");

    const logo = page.locator(".site-header-logo img.lax-logo-img").first();
    await expect(logo).toBeVisible();

    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(40);

    const offsetWidth = await logo.evaluate((el) => (el as HTMLImageElement).offsetWidth);
    expect(offsetWidth).toBeGreaterThanOrEqual(40);
  });
});
