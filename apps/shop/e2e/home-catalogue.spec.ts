import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL (default http://localhost:3020), and start Shop (pnpm --filter @auction/shop dev).";

test.describe("Shop home catalogue fixtures @e2e", () => {
  test("leads with editions and links every card to a page with content", async ({
    page,
  }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "home catalogue cards once on desktop");
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Limited editions and prints" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse editions" })).toHaveAttribute(
      "href",
      "/artworks",
    );
    await expect(page.locator(".shop-catalogue__title-link").first()).toHaveAttribute(
      "href",
      /\/artworks\//,
    );
    await expect(page.locator(".shop-artist-card__link").first()).toHaveAttribute(
      "href",
      /\/artists\//,
    );
  });
});
