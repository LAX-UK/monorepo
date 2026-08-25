import { expect, test } from "@playwright/test";
import {
  assertAdminRouteReady,
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  gotoAdminPath,
  seededStaffRoutes,
} from "./helpers/auth";
import { staffCatalogListRoutes } from "./helpers/staff-routes";

test.describe("staff catalog smoke @smoke", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  for (const route of staffCatalogListRoutes) {
    test(`${route.path} loads`, async ({ page }) => {
      const response = await gotoAdminPath(page, route.path);
      expect(response?.ok()).toBeTruthy();
      await dismissStaffPaletteIfOpen(page);
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible({
        timeout: 20_000,
      });
    });
  }

  test("category detail and edit load", async ({ page }) => {
    await gotoAdminPath(page, `/admin/categories/${seededStaffRoutes.categoryDetail}`);
    await dismissStaffPaletteIfOpen(page);
    await expect(page.getByRole("heading", { name: /paintings/i, level: 1 })).toBeVisible();
    await page.goto(`/admin/categories/${seededStaffRoutes.categoryDetail}/edit`);
    await expect(page.getByRole("heading", { name: /edit category/i })).toBeVisible();
  });

  test("artist detail and edit load", async ({ page }) => {
    await gotoAdminPath(page, `/admin/artists/${seededStaffRoutes.artistDetail}`);
    await assertAdminRouteReady(page);
    await dismissStaffPaletteIfOpen(page);
    await expect(page.getByText(/carolina price/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.goto(`/admin/artists/${seededStaffRoutes.artistDetail}/edit`);
    await expect(page.getByRole("heading", { name: /edit carolina price/i })).toBeVisible();
  });

  test("venue edit loads", async ({ page }) => {
    await gotoAdminPath(page, `/admin/venues/${seededStaffRoutes.venueDetail}/edit`);
    await expect(page.getByRole("heading", { name: /edit venue/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});
