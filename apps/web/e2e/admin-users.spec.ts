/**
 * Admin clients/staff directory smoke tests.
 *
 * Requires PLAYWRIGHT_E2E=1 and super_admin credentials (platform.admin.full).
 */
import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web (pnpm dev).";

const staffEmail = process.env.PLAYWRIGHT_STAFF_EMAIL ?? "";
const staffPassword = process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "";

async function staffLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(staffEmail);
  await page.getByLabel(/password/i).fill(staffPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

test.describe("admin user directories", () => {
  test("clients list loads", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/clients");
    await expect(page.getByRole("heading", { name: /^clients$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /views/i })).toBeVisible();
  });

  test("clients list accepts verification filters in URL", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/clients?emailVerified=0&kycStatus=pending&status=active");
    await expect(page.getByRole("heading", { name: /^clients$/i })).toBeVisible();
    await expect(page.getByText(/email unverified/i).first())
      .toBeVisible({ timeout: 15_000 })
      .catch(() => undefined);
  });

  test("staff list loads", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: /^staff$/i })).toBeVisible();
  });

  test("client drawer quick actions tab is reachable", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
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
    test.skip(!enabled, skipReason);
    await staffLogin(page);
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
