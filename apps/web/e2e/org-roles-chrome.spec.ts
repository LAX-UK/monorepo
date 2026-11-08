import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  ORGANISATION_JOURNEY_IDS,
  ORGANISATION_JOURNEY_NAMES,
  openAs,
} from "./helpers/organisation-journeys";

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

  test("on a phone the account button opens the account sheet, and any attention shows as the strip", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const session = await openAs(browser, roleAuthState.unapproved, approved, baseURL);
    const { page } = session;
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/bids");

      const accountButton = page.getByTestId("phone-account-button");
      await expect(accountButton).toBeVisible({ timeout: 30_000 });

      // The strip only exists when this person has something to act on, which depends on the
      // seeded purchases. When it does, it replaces the chip on a phone; never both.
      const strip = page.getByTestId("attention-strip");
      if ((await strip.count()) > 0) {
        await expect(strip).toBeVisible();
        await expect(page.getByTestId("attention-chip")).toBeHidden();
      } else {
        test.info().annotations.push({
          type: "note",
          description: "Nothing to act on for this seeded person; attention strip not asserted.",
        });
      }

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
    // Only a lot that is open for bidding has a bid bar; without a known live lot, skip
    // rather than guess from search (an ended lot would fail for the wrong reason).
    const lotPath = process.env.PLAYWRIGHT_LIVE_LOT_PATH;
    test.skip(lotPath == null, "Set PLAYWRIGHT_LIVE_LOT_PATH to an active lot.");
    test.setTimeout(120_000);
    const session = await openAs(browser, roleAuthState.unapproved, approved, baseURL);
    const { page } = session;
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(lotPath as string);

      const tabBar = page.getByTestId("bid-bottom-tab-bar");
      const bidBar = page.getByRole("region", { name: "Bidding" });
      // The bid bar shows once the in-page bid action has scrolled out of view.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(bidBar).toBeVisible({ timeout: 30_000 });
      // The tab bar steps aside by fading out and going inert, not by leaving the layout, and
      // Playwright counts a transparent element as visible. Its own state says it stepped aside.
      await expect(tabBar).toHaveAttribute("data-visible", "false");
      await expect(tabBar).toHaveAttribute("data-hidden-reason", "slot-claimed");
      await expect(tabBar).toHaveAttribute("inert", "");
    } finally {
      await session.close();
    }
  });

  test("a checkout page at 375px has no public tab bar", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const session = await openAs(browser, roleAuthState.unapproved, approved, baseURL);
    const { page } = session;
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      // The same seeded invoice the Pay page spec opens; the old checkout link lands on Pay.
      await page.goto(`/purchases/checkout/${ORGANISATION_JOURNEY_IDS.lotInvoiceNorthbankClear}`);
      await expect(page.getByRole("heading", { level: 1, name: "Pay" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByTestId("bid-bottom-tab-bar")).toHaveCount(0);
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
