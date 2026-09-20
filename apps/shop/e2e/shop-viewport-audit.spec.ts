import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL (default http://localhost:3020), and start Shop.";

const viewports = [
  { width: 375, height: 812 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

test.describe("Shop viewport audit @a11y", () => {
  for (const viewport of viewports) {
    test(`no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      test.skip(!enabled, skipReason);
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.locator("#main-content")).toBeVisible();
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth + 1;
      });
      expect(overflow).toBe(false);
    });
  }

  test("hero discover CTA is in viewport on mobile", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Discover" })).toBeInViewport();
  });

  test("desktop mega menu opens without overflowing and theme toggle swaps schemes", async ({
    page,
  }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop mega menu only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();

    const collect = page.getByRole("button", { name: "Collect" });
    await collect.click();
    await expect(collect).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "View all artworks" })).toBeVisible();
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflow).toBe(false);

    const logo = page.getByTestId("shop-header").getByRole("link", { name: "LAX Shop home" });
    const collectBox = await collect.boundingBox();
    const logoBox = await logo.boundingBox();
    expect(collectBox).toBeTruthy();
    expect(logoBox).toBeTruthy();
    expect((collectBox?.x ?? 0) - ((logoBox?.x ?? 0) + (logoBox?.width ?? 0))).toBeLessThan(80);
    expect(collectBox?.x ?? 0).toBeLessThan(640);

    const themeToggle = () =>
      page.getByRole("button", { name: /Switch to (dark|light) theme/ }).first();
    const startedDark = await page.locator("html").evaluate((el) => el.classList.contains("dark"));
    await themeToggle().click();
    await expect
      .poll(async () => page.locator("html").evaluate((el) => el.classList.contains("dark")))
      .toBe(!startedDark);
    await themeToggle().click();
    await expect
      .poll(async () => page.locator("html").evaluate((el) => el.classList.contains("dark")))
      .toBe(startedDark);
  });
});
