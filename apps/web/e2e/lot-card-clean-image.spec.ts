import { type Locator, type Page, expect, test } from "@playwright/test";
import { resolveSaleRoutes } from "./public-routes";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

/** The labels a lot card's full-width button may carry; each names what the button does. */
const CARD_BUTTON_LABELS = ["Bid", "Register to bid", "Leave a bid"];

/** The sale page's lot tiles (grid view), in catalogue order. */
function lotTiles(page: Page): Locator {
  return page.locator("#catalog article").filter({ has: page.getByTestId("lot-card-lot-line") });
}

/** The picture box of a tile: the link whose name starts with the lot, and its parent. */
function pictureBox(tile: Locator): Locator {
  return tile.locator("div.relative:has(> a[aria-label])").first();
}

async function opacity(locator: Locator): Promise<number> {
  return locator.evaluate((el) => Number(getComputedStyle(el).opacity));
}

test.describe("sale page lot card: clean picture @smoke", () => {
  let salePath = "";

  test.beforeAll(async ({ playwright }) => {
    if (!enabled) return;
    const request = await playwright.request.newContext();
    const [sale] = await resolveSaleRoutes(request);
    await request.dispose();
    salePath = sale?.path ?? "";
  });

  test.beforeEach(async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!salePath, "No seeded sale to open");
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("desktop: nothing on the picture at rest; heart on the Lot line; quick look on hover and focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${salePath}?view=grid`);
    const tile = lotTiles(page).first();
    await expect(tile).toBeVisible();
    await page.mouse.move(0, 0);

    // At rest the picture carries no visible control: the quick look label is there but unseen.
    const box = pictureBox(tile);
    const quickLook = box.getByRole("button", { name: /^Quick look at / });
    await expect(quickLook).toHaveCount(1);
    await expect.poll(() => opacity(quickLook)).toBe(0);
    await expect(box.getByRole("button", { name: /watchlist/ })).toHaveCount(0);

    // The save heart sits on the "Lot N" line, outside the picture, with a 44px tap area.
    const line = tile.getByTestId("lot-card-lot-line");
    const heart = line.getByRole("button", { name: /watchlist/ });
    await expect(heart).toBeVisible();
    const heartBox = await heart.boundingBox();
    expect(heartBox?.width).toBeGreaterThanOrEqual(44);
    expect(heartBox?.height).toBeGreaterThanOrEqual(44);
    const pictureBottom = await box.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(heartBox?.y ?? 0).toBeGreaterThanOrEqual(pictureBottom - 1);

    // Mouse over the card: the label shows.
    await tile.hover();
    await expect.poll(() => opacity(quickLook)).toBe(1);

    // Keyboard: from the picture link, Tab reaches the label, which shows and opens quick look.
    await page.mouse.move(0, 0);
    await box.locator("a[aria-label]").first().focus();
    await page.keyboard.press("Tab");
    await expect(quickLook).toBeFocused();
    await expect.poll(() => opacity(quickLook)).toBe(1);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("phone: no quick look trigger, and a tap on the picture opens the lot page", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(`${salePath}?view=grid`);
    const tile = lotTiles(page).first();
    await expect(tile).toBeVisible();
    await expect(page.getByRole("button", { name: /^Quick look at / })).toHaveCount(0);
    await expect(tile.getByTestId("lot-card-lot-line").getByRole("button")).toHaveCount(1);

    const picture = pictureBox(tile).locator("a[aria-label]").first();
    const href = await picture.getAttribute("href");
    await picture.tap();
    await page.waitForURL((url) => url.pathname === new URL(href ?? "", page.url()).pathname);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await context.close();
  });

  test("every card button names what it does, and goes where its label says", async ({ page }) => {
    await page.goto(`${salePath}?view=grid`);
    const tiles = lotTiles(page);
    await expect(tiles.first()).toBeVisible();
    // The live and viewer reads settle before the buttons show their final label.
    await expect(page.locator("#catalog [aria-busy='true']")).toHaveCount(0);
    const count = await tiles.count();
    let seen = 0;
    for (let i = 0; i < count; i += 1) {
      const tile = tiles.nth(i);
      const pictureHref = await pictureBox(tile)
        .locator("a[aria-label]")
        .first()
        .getAttribute("href");
      // The full-width button is the card's last link (after the picture and the title).
      const buttons = tile.getByRole("link", { name: /bid/i });
      for (const button of await buttons.all()) {
        const label = (await button.innerText()).trim();
        expect(CARD_BUTTON_LABELS).toContain(label);
        const href = (await button.getAttribute("href")) ?? "";
        if (label === "Bid") expect(href).toBe(pictureHref);
        if (label === "Leave a bid") expect(href).toBe(`${pictureHref}?bid=open`);
        if (label === "Register to bid") expect(href).not.toBe(pictureHref);
        seen += 1;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
