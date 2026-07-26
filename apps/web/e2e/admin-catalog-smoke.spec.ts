import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, seededStaffRoutes } from "./helpers/auth";
import { staffCatalogListRoutes } from "./helpers/staff-routes";

test.describe("staff catalog smoke @smoke", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  for (const route of staffCatalogListRoutes) {
    test(`${route.path} loads`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.ok()).toBeTruthy();
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
    });
  }

  test("category detail and edit load", async ({ page }) => {
    await page.goto(`/admin/categories/${seededStaffRoutes.categoryDetail}`);
    await expect(page.getByRole("heading", { name: /paintings/i, level: 1 })).toBeVisible();
    await page.goto(`/admin/categories/${seededStaffRoutes.categoryDetail}/edit`);
    await expect(page.getByRole("heading", { name: /edit category/i })).toBeVisible();
  });

  test("artist detail and edit load", async ({ page }) => {
    await page.goto(`/admin/artists/${seededStaffRoutes.artistDetail}`);
    await expect(page.getByRole("heading", { name: /carolina price/i, level: 1 })).toBeVisible();
    await page.goto(`/admin/artists/${seededStaffRoutes.artistDetail}/edit`);
    await expect(page.getByRole("heading", { name: /edit carolina price/i })).toBeVisible();
  });

  test("venue edit loads", async ({ page }) => {
    await page.goto(`/admin/venues/${seededStaffRoutes.venueDetail}/edit`);
    await expect(page.getByRole("heading", { name: /edit venue/i })).toBeVisible();
  });
});
