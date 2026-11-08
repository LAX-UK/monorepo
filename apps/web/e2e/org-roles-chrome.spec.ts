import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import { ORGANISATION_JOURNEY_NAMES, openAs } from "./helpers/organisation-journeys";

/**
 * The shared header chrome in Bid for a signed-in person: the phone tab bar, the phone menu, the
 * account sheet and the attention strip. It reuses the saved unapproved-buyer session (no new
 * sign-in) acting as Northbank Gallery, which has an invoice waiting to be paid.
 */
const { approved } = ORGANISATION_JOURNEY_NAMES;

test.describe("shared header chrome @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("tab bar is present at 375px and hidden at 1440px, and the phone menu traps focus", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const session = await openAs(browser, roleAuthState.unapproved, approved, baseURL);
    const { page } = session;
    try {
      const bar = page.getByTestId("bid-bottom-tab-bar");

      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/");
      await expect(bar).toBeVisible();

      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(bar).toBeHidden();

      await page.setViewportSize({ width: 375, height: 812 });
      const trigger = page.getByRole("button", { name: "Open menu" });
      await trigger.click();
      const menu = page.getByRole("dialog", { name: "Menu" });
      await expect(menu).toBeVisible();
      for (let step = 0; step < 12; step++) {
        await page.keyboard.press("Tab");
        await expect(menu.locator(":focus")).toHaveCount(1);
      }
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();
    } finally {
      await session.close();
    }
  });

  test("on a phone the account button opens the account sheet and the attention strip shows", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const session = await openAs(browser, roleAuthState.unapproved, approved, baseURL);
    const { page } = session;
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/bids");

      const strip = page.getByTestId("attention-strip");
      await expect(strip).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("attention-chip")).toBeHidden();

      const accountButton = page.getByTestId("phone-account-button");
      await expect(accountButton).toBeVisible();
      await accountButton.click();
      await expect(page.getByRole("dialog", { name: "Switch account" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Switch account" })).toBeHidden();
      await expect(accountButton).toBeFocused();
    } finally {
      await session.close();
    }
  });

  test("on a live lot page the bid bar replaces the tab bar", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const session = await openAs(browser, roleAuthState.unapproved, approved, baseURL);
    const { page } = session;
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      // The same live lot the bid-flow specs use; otherwise the first lot the search lists.
      let lotPath = process.env.PLAYWRIGHT_LIVE_LOT_PATH;
      if (!lotPath) {
        await page.goto("/search");
        const firstLot = page.locator('a[href^="/lot/"]').first();
        await expect(firstLot).toBeVisible({ timeout: 30_000 });
        lotPath = (await firstLot.getAttribute("href")) ?? undefined;
      }
      test.skip(!lotPath, "no lot is seeded to open");
      await page.goto(lotPath as string);

      const tabBar = page.getByTestId("bid-bottom-tab-bar");
      const bidBar = page.getByRole("region", { name: "Bidding" });
      // The bid bar shows once the in-page bid action has scrolled out of view.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(bidBar).toBeVisible({ timeout: 30_000 });
      await expect(tabBar).toBeHidden();
    } finally {
      await session.close();
    }
  });

  test("the account area at 375px has no public tab bar", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const session = await openAs(browser, roleAuthState.unapproved, approved, baseURL);
    const { page } = session;
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/purchases");
      // The account area's own phone chrome has rendered before the absence is checked.
      await expect(page.getByTestId("phone-account-button")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("bid-bottom-tab-bar")).toHaveCount(0);
    } finally {
      await session.close();
    }
  });
});
