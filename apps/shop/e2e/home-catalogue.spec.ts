import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL (default http://localhost:3020), and start Shop (pnpm --filter @auction/shop dev).";

test.describe("Shop home catalogue fixtures @e2e", () => {
  test("renders seeded, navigable cards for every catalogue section", async ({
    page,
  }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "home catalogue cards once on desktop");
    await page.goto("/");

    await expect(page.locator(".shop-home__original-card").first()).toHaveAttribute(
      "href",
      /\/artworks\//,
    );
    await expect(page.locator(".shop-home__category-card").first()).toHaveAttribute(
      "href",
      /\/categories\//,
    );
    await expect(page.locator(".shop-home__print-card").first()).toHaveAttribute(
      "href",
      /\/artworks\//,
    );
    await expect(page.locator(".shop-home__artist-card").first()).toHaveAttribute(
      "href",
      /\/artists\//,
    );
  });

  test("shows forward rail affordance when a home row overflows", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop rail affordance only");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const printsRail = page.locator("#prints-rail");
    await expect(printsRail).toBeVisible();
    const overflow = await printsRail.evaluate((el) => el.scrollWidth - el.clientWidth > 4);
    test.skip(!overflow, "Prints rail has no overflow in this viewport");
    const forward = page.getByRole("button", { name: "Scroll to see more prints and multiples" });
    await expect(forward).toBeVisible();
    await forward.focus();
    await expect(forward).toBeFocused();
    const before = await printsRail.evaluate((el) => el.scrollLeft);
    await forward.click();
    await expect
      .poll(async () => printsRail.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(before);
  });
});
