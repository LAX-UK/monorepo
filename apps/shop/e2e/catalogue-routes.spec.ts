import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and seed the Shop catalogue.";

test.describe("Shop catalogue routes @a11y", () => {
  for (const route of [
    { path: "/artworks", heading: "Artworks" },
    { path: "/artists", heading: "Artists" },
    { path: "/categories", heading: "Categories" },
    { path: "/artworks/vessel-study", heading: "Vessel Study" },
    { path: "/artists/emmett-king", heading: "Emmett King" },
    { path: "/categories/art", heading: "Art" },
  ]) {
    test(`${route.path} renders its catalogue contract`, async ({ page }) => {
      test.skip(!enabled, skipReason);
      const response = await page.goto(route.path);

      expect(response?.ok()).toBeTruthy();
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(
        axe.violations.filter((violation) =>
          ["critical", "serious", "moderate"].includes(violation.impact ?? ""),
        ),
      ).toEqual([]);
    });
  }
});
