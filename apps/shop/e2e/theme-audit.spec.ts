import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { applyShopThemeForE2e } from "./shop-theme-e2e";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL (default http://localhost:3020), and start Shop.";

const THEMES = ["light", "dark"] as const;
const ROUTES = ["/", "/artworks", "/categories", "/artists"] as const;

function formatViolations(
  violations: ReadonlyArray<{ id: string; impact?: string | null; help: string }>,
) {
  return violations.map((v) => `  - ${v.id} (${v.impact ?? "?"}): ${v.help}`).join("\n");
}

test.describe("Shop theme audit @a11y", () => {
  for (const theme of THEMES) {
    for (const route of ROUTES) {
      test(`${theme} mode passes color-contrast on ${route}`, async ({ page }) => {
        test.skip(!enabled, skipReason);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await applyShopThemeForE2e(page, theme);
        const res = await page.goto(route);
        expect(res?.ok()).toBeTruthy();
        await expect(page.locator("#main-content")).toBeVisible();

        const axe = await new AxeBuilder({ page })
          .include("#main-content")
          .exclude(".shop-home__hero")
          .withRules(["color-contrast"])
          .analyze();
        const contrast = axe.violations.filter((v) => v.id === "color-contrast");
        expect(
          contrast,
          `color-contrast (${theme} ${route}):\n${formatViolations(contrast)}`,
        ).toEqual([]);
      });
    }
  }

  test("header theme toggle persists class on html", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop header theme toggle only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await applyShopThemeForE2e(page, "light");
    await page.goto("/");
    const themeToggle = () =>
      page.getByRole("button", { name: /Switch to (dark|light) theme/ }).first();
    await themeToggle().click();
    await expect
      .poll(async () => page.locator("html").evaluate((el) => el.classList.contains("dark")))
      .toBe(true);
    await themeToggle().click();
    await expect
      .poll(async () => page.locator("html").evaluate((el) => el.classList.contains("dark")))
      .toBe(false);
  });
});
