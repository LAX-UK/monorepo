import { type Page, expect, test } from "@playwright/test";
import { accountAuthState } from "./helpers/account-auth-state";
import { collectorSkipReason, expectPageHeading } from "./helpers/account-e2e";

const skipReason = collectorSkipReason();
const BAR = '[data-testid="account-bottom-tab-bar"]';
const PHONE = { width: 375, height: 812 };

/** Changes the saved time zone, which is confirmed by a toast (the only toast Account raises). */
async function raiseToast(page: Page): Promise<void> {
  await page.goto("/account/profile");
  await page.getByRole("button", { name: "Change: Time zone for emails and dates" }).click();
  await page.getByRole("radio", { name: "Always use" }).check();
  await page.getByRole("searchbox", { name: "Search cities" }).fill("Tokyo");
  const tokyo = page.getByRole("radio", { name: /Tokyo/ });
  if (await tokyo.isChecked()) {
    await page.getByRole("searchbox", { name: "Search cities" }).fill("Lima");
    await page.getByRole("radio", { name: /Lima/ }).check();
  } else {
    await tokyo.check();
  }
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

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

  test("marks Portfolio on a nested route", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/account/portfolio");
    await expectPageHeading(page, "Portfolio");
    const detail = page.locator('a[href^="/account/portfolio/"]:not([href$="/money"])').first();
    test.skip((await detail.count()) === 0, "no work detail link in this seed");
    const href = await detail.getAttribute("href");
    await page.goto(href ?? "/account/portfolio");
    const bar = page.locator(BAR);
    await expect(bar.getByRole("link", { name: "Portfolio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(bar.getByRole("link", { name: "Money" })).not.toHaveAttribute("aria-current");
  });

  test("marks More as current on Security, to the eye and to assistive tech", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/account/security");
    const bar = page.locator(BAR);
    await expect(bar.getByRole("button", { name: "More" })).toHaveAttribute("aria-current", "true");
    await expect(bar.locator("a[aria-current]")).toHaveCount(0);
  });

  test("every tab is at least 44px tall", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/account");
    const bar = page.locator(BAR);
    await expect(bar).toBeVisible();
    for (const tab of [
      bar.getByRole("link", { name: "Home" }),
      bar.getByRole("link", { name: "Portfolio" }),
      bar.getByRole("link", { name: "Money" }),
      bar.getByRole("button", { name: "More" }),
    ]) {
      const box = await tab.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("the keyboard reaches the bar, opens More, and Escape returns focus to More", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/account/security");
    const bar = page.locator(BAR);
    const more = bar.getByRole("button", { name: "More" });
    await expect(more).toBeVisible();
    await more.focus();
    await expect(more).toBeFocused();
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();
  });

  test("the last piece of content ends above the bar once scrolled to the bottom", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/account/security");
    const bar = page.locator(BAR);
    await expect(bar).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const barTop = (await bar.boundingBox())?.y ?? 0;
    const lastBottom = await page.evaluate(() => {
      const main = document.querySelector("main");
      const last = main?.lastElementChild ?? main;
      return last ? last.getBoundingClientRect().bottom : Number.POSITIVE_INFINITY;
    });
    expect(lastBottom).toBeLessThanOrEqual(barTop);
  });

  test("a toast sits above the bar, not on its tabs", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await raiseToast(page);
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toBeVisible();
    const barTop = (await page.locator(BAR).boundingBox())?.y ?? 0;
    // Sonner slides a new toast in; wait until it has settled before measuring it.
    await expect
      .poll(async () => (await toast.boundingBox())?.y ?? 0, { message: "toast has settled" })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => {
        const box = await toast.boundingBox();
        return box ? box.y + box.height : Number.POSITIVE_INFINITY;
      })
      .toBeLessThanOrEqual(barTop);
  });
});
