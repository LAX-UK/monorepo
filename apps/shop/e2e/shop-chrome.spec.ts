import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL (default http://localhost:3020), and start Shop (pnpm --filter @auction/shop dev).";

/**
 * The shared header chrome in Shop: the bottom tab bar is a phone-only dock, and the phone menu
 * keeps keyboard focus inside itself. Signed out, so no sign-in is made.
 */
test.describe("Shop shared chrome @smoke", () => {
  test.skip(!enabled, skipReason);

  test("bottom tab bar is present at 375px and hidden at 1440px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "sizes are set by the test");
    const bar = page.getByRole("navigation", { name: "Shortcuts" });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(bar).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(bar).toBeHidden();
  });

  test("phone menu opens, keeps focus inside, and closes", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "sizes are set by the test");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Open menu", exact: true });
    await trigger.click();

    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    for (let step = 0; step < 12; step++) {
      await page.keyboard.press("Tab");
      await expect(menu.locator(":focus")).toHaveCount(1);
    }

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
