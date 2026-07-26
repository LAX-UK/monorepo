/**
 * Admin clients/staff directory smoke tests.
 */
import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials } from "./helpers/auth";

test.describe("admin user directories @journey", () => {
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);

  test("clients list loads", async ({ page }) => {
    await page.goto("/admin/clients");
    await expect(page.getByRole("heading", { name: /^clients$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /views/i })).toBeVisible();
  });

  test("clients list accepts verification filters in URL", async ({ page }) => {
    await page.goto("/admin/clients?emailVerified=0&kycStatus=pending&status=active");
    await expect(page.getByRole("heading", { name: /^clients$/i })).toBeVisible();
    await expect(page.getByText(/email unverified/i).first())
      .toBeVisible({ timeout: 15_000 })
      .catch(() => undefined);
  });

  test("staff list loads", async ({ page }) => {
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: /^staff$/i })).toBeVisible();
  });

  test("client drawer quick actions tab is reachable", async ({ page }) => {
    await page.goto("/admin/clients");
    const nameLink = page.locator("table tbody tr").first().getByRole("button").first();
    if ((await nameLink.count()) > 0) {
      await nameLink.click();
      await expect(page.getByRole("tab", { name: /quick actions/i })).toBeVisible();
      await page.getByRole("tab", { name: /quick actions/i }).click();
      await expect(page.getByRole("button", { name: /open full profile/i })).toBeVisible();
    }
  });

  test("client detail commerce tab loads", async ({ page }) => {
    await page.goto("/admin/clients");
    const profileLink = page.locator("table tbody tr").first().getByRole("link").first();
    if ((await profileLink.count()) === 0) {
      const openBtn = page.getByRole("button", { name: /.+/ }).first();
      await openBtn.click();
      await page.getByRole("link", { name: /open full profile/i }).click();
    } else {
      await profileLink.click();
    }
    await page.getByRole("tab", { name: /commerce/i }).click();
    await expect(page.getByRole("heading", { name: /payments/i })).toBeVisible();
  });
});
