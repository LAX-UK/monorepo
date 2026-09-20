import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL (default http://localhost:3020), and seed Shop.";

test.describe("Shop artwork detail @a11y", () => {
  test("renders catalogue media and route metadata", async ({ page }) => {
    test.skip(!enabled, skipReason);
    const response = await page.goto("/artworks/vessel-study");
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: "Vessel Study" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Vessel Study by Flora Powers" })).toBeVisible();
    await expect(page).toHaveTitle("Vessel Study | LAX Shop");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/artworks\/vessel-study$/,
    );

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const blocking = axe.violations.filter((violation) =>
      ["critical", "serious", "moderate"].includes(violation.impact ?? ""),
    );
    expect(blocking).toEqual([]);
  });

  test("keeps artwork content available without JavaScript", async ({ browser }) => {
    test.skip(!enabled, skipReason);
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/artworks/vessel-study");
    await expect(page.getByRole("heading", { level: 1, name: "Vessel Study" })).toBeVisible();
    await context.close();
  });
});
