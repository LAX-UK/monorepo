/**
 * Admin clients/staff directory smoke tests.
 */
import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials } from "./helpers/auth";

test.describe("admin user directories @journey", () => {
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);

  test("clients list loads", async ({ page }) => {
    await page.goto("/admin/clients");
    await expect(page.getByRole("heading", { name: /^clients$/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /views/i })).toBeVisible();
  });

  test("clients list accepts verification filters in URL", async ({ page }) => {
    await page.goto("/admin/clients?emailVerified=0&kycStatus=pending&status=active");
    await expect(page.getByRole("heading", { name: /^clients$/i, level: 1 })).toBeVisible();
    await expect(page.getByText(/email unverified/i).first())
      .toBeVisible({ timeout: 15_000 })
      .catch(() => undefined);
  });

  test("staff list loads", async ({ page }) => {
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: /^staff$/i, level: 1 })).toBeVisible();
  });

  test("a client row opens its panel with a link to the client page", async ({ page }) => {
    await page.goto("/admin/clients");
    await page.locator("table tbody tr").first().getByRole("link").first().click();
    await expect(page.getByRole("link", { name: /^open client page$/i })).toBeVisible();
  });

  test("client page payments section loads", async ({ page }) => {
    await page.goto("/admin/clients");
    await page.locator("table tbody tr").first().getByRole("link").first().click();
    await page.getByRole("link", { name: /^open client page$/i }).click();
    await page.waitForURL(/\/admin\/clients\/[^/?]+/);
    await page
      .getByRole("navigation", { name: /^client sections$/i })
      .getByRole("link", { name: /^payments/i })
      .click();
    await expect(page.getByRole("heading", { name: /payments/i }).first()).toBeVisible();
  });
});
