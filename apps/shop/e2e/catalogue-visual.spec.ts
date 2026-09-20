import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const visual = process.env.PLAYWRIGHT_VISUAL === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_VISUAL=1, PLAYWRIGHT_BASE_URL, and start Shop with seeded catalogue.";

test.describe("Shop catalogue visuals @visual", () => {
  test("artworks hub matches baseline on desktop", async ({ page }) => {
    test.skip(!enabled || !visual, skipReason);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/artworks");
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page).toHaveScreenshot("shop-artworks-hub-desktop.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
