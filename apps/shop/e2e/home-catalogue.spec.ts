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
});
