import { expect, test } from "@playwright/test";

test.describe("Artworks catalogue filters @a11y", () => {
  test("exposes sticky toolbar, sort, and desktop filter rail", async ({ page }, testInfo) => {
    await page.goto("/artworks");
    await expect(page.getByRole("heading", { name: "Artworks", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Sort artworks")).toBeVisible();
    if (testInfo.project.name === "chromium-desktop") {
      await expect(page.getByRole("complementary", { name: "Filters" })).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: /Filters/i })).toBeVisible();
    }
  });

  test("preserves type filter in URL for prints deep link", async ({ page }) => {
    await page.goto("/artworks?type=edition");
    await expect(page).toHaveURL(/type=edition/);
    await expect(page.getByRole("heading", { name: "Prints & Multiples", level: 1 })).toBeVisible();
  });
});
