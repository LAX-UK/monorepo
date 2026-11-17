import { type Locator, type Page, expect, test } from "@playwright/test";
import { resolveSaleRoutes } from "./public-routes";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

/** The page the visitor was on before the sale page; Back past the quick look must land here. */
const START_PATH = "/sales?tab=live";

type Opened = { trigger: Locator; dialog: Locator; saleUrl: string; scrollBefore: number };

/**
 * Waits until the page height has held still for half a second. The sale page settles its height
 * shortly after it renders (and again after Back), which moves the scroll position by itself.
 */
async function waitForStableLayout(page: Page) {
  let last = -1;
  let stableSince = Date.now();
  await expect
    .poll(
      async () => {
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        if (height !== last) {
          last = height;
          stableSince = Date.now();
        }
        return Date.now() - stableSince;
      },
      { intervals: [100], timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(500);
}

/** Parks the list part-way down so a jump to the top (or anywhere else) would show, then opens. */
async function openQuickLook(page: Page): Promise<Opened> {
  const trigger = page.getByRole("button", { name: /^Quick look at / }).nth(1);
  await waitForStableLayout(page);
  await trigger.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy({ top: -80, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const saleUrl = page.url();

  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "View lot" })).toBeInViewport();
  return { trigger, dialog, saleUrl, scrollBefore };
}

/** Back closes the quick look and leaves the list as it was. */
async function expectBackCloses(page: Page, { trigger, dialog, saleUrl, scrollBefore }: Opened) {
  await page.goBack();
  await expect(dialog).toBeHidden();
  expect(page.url()).toBe(saleUrl);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await expect(trigger).toBeFocused();
}

/** One more Back leaves the sale page: the quick look added exactly one entry and left none. */
async function expectBackLeaves(page: Page, previousUrl: string) {
  await page.goBack();
  await expect(page).toHaveURL(previousUrl);
}

test.describe("lot quick look @smoke", () => {
  let salePath = "";
  let saleId = "";

  test.beforeAll(async ({ playwright }) => {
    if (!enabled) return;
    // Once per file: the public API rate-limits, and the sale is the same for every test.
    const request = await playwright.request.newContext();
    const [sale] = await resolveSaleRoutes(request);
    await request.dispose();
    salePath = sale?.path ?? "";
    saleId = salePath.split("/").pop() ?? "";
  });

  test.beforeEach(async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!salePath, "No seeded sale to open");
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  /** Opens the sale from the sales calendar by clicking its link, as a visitor would. */
  async function reachSaleByLink(page: Page) {
    await page.goto(START_PATH);
    const startUrl = page.url();
    const link = page.locator(`a[href*="${saleId}"]`).first();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL((url) => url.pathname.includes(saleId));
    await expect(page.getByRole("button", { name: /^Quick look at / }).nth(1)).toBeVisible();
    return startUrl;
  }

  /** Loads the sale page with a full page load, on top of an earlier page. */
  async function reachSaleByLoad(page: Page) {
    await page.goto(START_PATH);
    const startUrl = page.url();
    await page.goto(salePath);
    // The id-only address redirects to the sale's canonical one; wait for that to land.
    await page.waitForURL(
      (url) => url.pathname.includes(saleId) && !url.pathname.startsWith("/sales/sale/"),
    );
    await page.waitForLoadState("load");
    return startUrl;
  }

  test("after a full page load, Back closes the quick look and the next Back leaves", async ({
    page,
  }) => {
    const startUrl = await reachSaleByLoad(page);
    await expectBackCloses(page, await openQuickLook(page));
    await expectBackLeaves(page, startUrl);
  });

  test("after client navigation, Back closes the quick look and the next Back leaves", async ({
    page,
  }) => {
    const startUrl = await reachSaleByLink(page);
    await expectBackCloses(page, await openQuickLook(page));
    await expectBackLeaves(page, startUrl);
  });

  test("closing with X leaves no history entry behind", async ({ page }) => {
    const startUrl = await reachSaleByLink(page);
    const { dialog, saleUrl } = await openQuickLook(page);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    expect(page.url()).toBe(saleUrl);
    await expectBackLeaves(page, startUrl);
  });

  test("Back from the lot page returns to the list, not to a leftover quick-look step", async ({
    page,
  }) => {
    const startUrl = await reachSaleByLink(page);
    const { dialog, saleUrl } = await openQuickLook(page);
    const viewLot = dialog.getByRole("link", { name: "View lot" });
    const lotPath = new URL((await viewLot.getAttribute("href")) ?? "", saleUrl).pathname;
    await viewLot.click();
    await page.waitForURL((url) => url.pathname === lotPath);
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goBack();
    await expect(page).toHaveURL(saleUrl);
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await page.evaluate(() => window.history.state?.__laxQuickLook ?? null)).toBeNull();
    // Scroll is not compared here: the sale page shifts its scroll after Back from any lot page
    // (a plain lot link does the same), which is outside the quick look.
    await expectBackLeaves(page, startUrl);
  });

  test("after a reload, Back still closes the next quick look", async ({ page }) => {
    const startUrl = await reachSaleByLink(page);
    await openQuickLook(page);
    await page.reload();
    await expect(page.getByRole("dialog")).toBeHidden();

    await expectBackCloses(page, await openQuickLook(page));
    await expectBackLeaves(page, startUrl);
  });

  test("Forward after Back reopens the quick look rather than a step that does nothing", async ({
    page,
  }) => {
    const startUrl = await reachSaleByLink(page);
    const opened = await openQuickLook(page);
    await expectBackCloses(page, opened);
    await page.goForward();
    await expect(opened.dialog).toBeVisible();
    await page.goBack();
    await expect(opened.dialog).toBeHidden();
    await expectBackLeaves(page, startUrl);
  });
});
