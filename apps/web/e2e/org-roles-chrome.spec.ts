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
    } finally {
      await session.close();
    }
  });
});
