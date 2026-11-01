/**
 * Admin disputes list smoke.
 *
 * Requires PLAYWRIGHT_E2E=1 and staff credentials with finance/disputes access.
 */
import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials } from "./helpers/auth";

test.describe("admin disputes @journey", () => {
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);

  test("disputes page loads with its queues and table shell", async ({ page }) => {
    await page.goto("/admin/disputes");
    await expect(page.getByRole("heading", { name: "Disputes", level: 1 })).toBeVisible();
    await expect(page.locator('a[href="/admin/disputes?view=closed"]')).toBeVisible();
  });

  test("choosing a queue updates the URL", async ({ page }) => {
    await page.goto("/admin/disputes");
    await page.locator('a[href^="/admin/disputes?view=needs_allocation"]').click();
    await expect(page).toHaveURL(/view=needs_allocation/);
  });

  test("pagination updates the offset when a next page is available", async ({ page }) => {
    await page.goto("/admin/disputes?view=all&limit=10&offset=0");
    const next = page.getByRole("link", { name: /next page/i });
    if (await next.isVisible()) {
      await next.click();
      await expect(page).toHaveURL(/offset=10/);
    }
  });
});
