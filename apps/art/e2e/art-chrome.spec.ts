import { expect, test } from "@playwright/test";
import { artE2eEnabled, artE2eSkipReason, firstArtworkHref } from "./helpers/art-e2e";

/**
 * The shared header chrome on lax.art: the bottom tab bar is a phone-only dock, and the phone
 * menu keeps keyboard focus inside itself. Signed out, so no sign-in is made.
 */
test.describe("lax.art shared chrome @smoke", () => {
  test.skip(!artE2eEnabled, artE2eSkipReason);

  test("bottom tab bar is present at 375px and hidden at 1440px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "sizes are set by the test");
    const bar = page.getByTestId("art-bottom-tab-bar");

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/artworks");
    await expect(bar).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(bar).toBeHidden();
  });

  test("phone menu opens, keeps focus inside, and closes", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "sizes are set by the test");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/artworks");
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();

    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    for (let step = 0; step < 12; step++) {
      await page.keyboard.press("Tab");
      await expect(menu.locator(":focus")).toHaveCount(1);
    }
    await page.keyboard.press("Shift+Tab");
    await expect(menu.locator(":focus")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("on an artwork page the sticky action bar and the tab bar are never both shown", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "sizes are set by the test");
    await page.setViewportSize({ width: 375, height: 812 });
    const href = await firstArtworkHref(page);
    test.skip(href === null, "the art channel has no published works");
    await page.goto(href as string);

    const conversations = page.getByTestId("art-artwork-conversations");
    await expect(conversations).toBeVisible();
    const tabBar = page.getByTestId("art-bottom-tab-bar");
    const actionBar = page.getByRole("region", { name: "Artwork actions" });
    // Wait until one of the two bars has rendered, so a late action bar is not read as "sold".
    await expect(actionBar.or(tabBar).first()).toBeVisible({ timeout: 30_000 });
    // A sold work has no action bar; then the tab bar keeps the slot. Either way, one at a time.
    if ((await actionBar.count()) === 0) {
      await expect(tabBar).toBeVisible();
      return;
    }
    await expect(actionBar).toBeVisible();
    await expect(tabBar).toBeHidden();
  });
});
