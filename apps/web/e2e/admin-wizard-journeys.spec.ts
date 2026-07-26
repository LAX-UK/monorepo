import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";

test.describe("staff wizard journeys @journey", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("sale and lot setup entry points expose their first steps", async ({ page }) => {
    await page.goto("/admin/sales/new");
    await expect(page.getByRole("heading", { name: /new sale|set up sale/i })).toBeVisible();
    await expect(page.getByText(/step 1 of 6/i)).toBeVisible();

    await page.goto("/admin/lots/new");
    await expect(page.getByRole("heading", { name: /new lot/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^continue/i })).toBeVisible();
  });

  test("creates a category through the full wizard", async ({ page }) => {
    await page.goto("/admin/categories/new");
    await page.getByLabel(/name/i).first().fill(`E2E Test Category ${Date.now()}`);
    await page.getByRole("button", { name: /^continue/i }).click();
    await page.getByRole("button", { name: /create category/i }).click();
    await expect(page).toHaveURL(/\/admin\/categories/);
  });

  for (const route of [
    { path: "/admin/artists/new", heading: /new artist/i, submit: /create artist/i },
    { path: "/admin/venues/new", heading: /new venue/i, submit: /create venue/i },
  ]) {
    test(`${route.path} starts on the first wizard step`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      await expect(page.getByRole("button", { name: /^continue/i })).toBeVisible();
      await expect(page.getByRole("button", { name: route.submit })).toHaveCount(0);
    });
  }

  test("legacy venue create URL redirects to the full-page wizard", async ({ page }) => {
    await page.goto("/admin/venues?new=1");
    await expect(page).toHaveURL(/\/admin\/venues\/new$/);
  });
});
