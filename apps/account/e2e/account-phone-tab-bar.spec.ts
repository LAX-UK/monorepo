import { expect, test } from "@playwright/test";
import { accountAuthState } from "./helpers/account-auth-state";
import { collectorSkipReason, expectPageHeading } from "./helpers/account-e2e";

const skipReason = collectorSkipReason();
const BAR = '[data-testid="account-bottom-tab-bar"]';

// HC-PW2: the phone tab bar shows on a phone, is gone on desktop, More opens the existing menu
// sheet, and only one bottom bar is ever on screen.
test.describe("Account phone tab bar HC-PW2", () => {
  test.skip(skipReason !== null, skipReason ?? "");
  test.use({ storageState: accountAuthState.collector });

  test("is visible at 375px with the current page marked", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/account/portfolio/money");
    await expectPageHeading(page, /./);
    const bar = page.locator(BAR);
    await expect(bar).toBeVisible();
    await expect(page.locator("nav[data-testid$='bottom-tab-bar']")).toHaveCount(1);
    await expect(bar.getByRole("link")).toHaveText(["Home", "Portfolio", "Money"]);
    await expect(bar.getByRole("link", { name: "Money" })).toHaveAttribute("aria-current", "page");
    const box = await bar.getByRole("link", { name: "Home" }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("is hidden at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/account");
    await expectPageHeading(page, /./);
    await expect(page.locator(BAR)).toBeHidden();
  });

  test("More opens the account menu and the bar steps aside", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/account/security");
    const bar = page.locator(BAR);
    const more = bar.getByRole("button", { name: "More" });
    await expect(more).toBeVisible();
    await more.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("link", { name: "Security" })).toBeVisible();
    // One bar at a time: the sheet is open, so the tab bar is hidden and inert.
    await expect(bar).toHaveAttribute("data-visible", "false");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(bar).toHaveAttribute("data-visible", "true");
  });
});
