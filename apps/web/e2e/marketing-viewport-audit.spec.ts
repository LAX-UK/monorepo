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

/** A cover slide with a photograph must have drawn it; a slide without one has nothing to check. */
async function expectCoverPhotoLoadedWhenPresent(cover: import("@playwright/test").Locator) {
  const photo = cover.locator("picture img").first();
  if ((await photo.count()) === 0) return;
  await expect
    .poll(() => photo.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
}

test.describe("marketing viewport audit @a11y", () => {
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

    // The seeded sales carry no photograph, so the cover is checked on its type and its button;
    // a photograph, where a slide has one, must have loaded.
    const cover = page.getByRole("region", { name: "Featured sales" });
    await expect(cover).toBeVisible();
    await expectCoverPhotoLoadedWhenPresent(cover);

    const cta = page.getByRole("link", { name: /^(Join the saleroom|View lots)$/ }).first();
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

    const heroShell = page.getByRole("region", { name: "Featured sales" });
    await expect(heroShell).toBeVisible();
    await expectCoverPhotoLoadedWhenPresent(heroShell);

    // Hero bleeds under the fixed header: one viewport tall below the header (HOME_HERO_MIN_H).
    const heroBox = await heroShell.boundingBox();
    const headerHeight = await page.evaluate(() =>
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--header-height"),
      ),
    );
    expect(heroBox?.height).toBeDefined();
    if (heroBox?.height) {
      expect(heroBox.height).toBeLessThanOrEqual(1080 + headerHeight + 1);
    }

    const cta = page.getByRole("link", { name: /^(Join the saleroom|View lots)$/ }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toBeInViewport();

    await assertNoHorizontalOverflow(page);
  });
});
