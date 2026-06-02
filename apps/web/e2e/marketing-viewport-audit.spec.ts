import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

const VIEWPORTS = [
  { width: 375, height: 812, label: "mobile" },
  { width: 768, height: 1024, label: "tablet" },
  { width: 1280, height: 800, label: "laptop" },
  { width: 1440, height: 900, label: "desktop" },
  { width: 1920, height: 1080, label: "desktop-xl" },
] as const;

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth <= doc.clientWidth + 1;
  });
  expect(overflow).toBe(true);
}

test.describe("marketing viewport audit", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.label} (${viewport.width}x${viewport.height}) — no horizontal overflow on / and /search`, async ({
      page,
    }) => {
      test.skip(!enabled, skipReason);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const path of ["/", "/search"]) {
        await page.goto(path);
        await page.waitForLoadState("domcontentloaded");
        await assertNoHorizontalOverflow(page);
      }
    });
  }

  test("mobile home — hero cover loads and CTA is in viewport", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const heroImg = page
      .locator('[aria-label="Upcoming salerooms"] picture img, section picture img')
      .first();
    await expect(heroImg).toBeVisible();

    const naturalWidth = await heroImg.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);

    const cta = page.getByRole("link", { name: "Open saleroom" }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toBeInViewport();

    await assertNoHorizontalOverflow(page);
  });

  test("laptop — open mega menu without horizontal overflow", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/search");
    await page.waitForLoadState("domcontentloaded");

    const trigger = page.getByRole("button", { name: /auctions/i }).first();
    await trigger.hover();
    await expect(page.locator(".header-megamenu")).toBeVisible();

    await assertNoHorizontalOverflow(page);
  });

  test("desktop xl (1920x1080) — hero cover visible and CTA in viewport", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const heroShell = page.locator('[aria-label="Upcoming salerooms"]').first();
    const heroImg = page
      .locator('[aria-label="Upcoming salerooms"] picture img, section picture img')
      .first();

    const hasRotator = (await heroShell.count()) > 0;
    test.skip(!hasRotator, "No hero rotator on home; seed scheduled sales for this check");

    await expect(heroImg).toBeVisible();
    const naturalWidth = await heroImg.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);

    const heroBox = await heroShell.boundingBox();
    expect(heroBox?.height).toBeDefined();
    if (heroBox?.height) {
      expect(heroBox.height).toBeLessThanOrEqual(820);
    }

    const cta = page.getByRole("link", { name: "Open saleroom" }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toBeInViewport();

    await assertNoHorizontalOverflow(page);
  });
});
