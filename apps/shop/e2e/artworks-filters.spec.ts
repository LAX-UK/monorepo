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

  test("offers no originals or price-on-request filters", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop filter rail only");
    await page.goto("/artworks");
    const rail = page.getByRole("complementary", { name: "Filters" });
    await expect(rail.getByText("Artwork type")).toHaveCount(0);
    await expect(rail.getByRole("button", { name: "Originals" })).toHaveCount(0);
    await expect(rail.getByRole("button", { name: "Price on request" })).toHaveCount(0);
  });
});
