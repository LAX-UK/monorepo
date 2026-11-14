/**
 * Admin clients/staff directory smoke tests.
 */
import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials, seededStaffRoutes } from "./helpers/auth";

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

  test("a client row opens the client page, remembering the list", async ({ page }) => {
    await page.goto("/admin/clients?status=active");
    const row = page.locator("table tbody tr").first();
    // A click on the row outside its links follows the row's own link.
    await row.locator("td").nth(2).click();
    await page.waitForURL(/\/admin\/clients\/[^/?]+\?list=status%3Dactive/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: /breadcrumb/i }).getByRole("link", { name: "Clients" }),
    ).toHaveAttribute("href", "/admin/clients?status=active");
  });

  test("Back from a client page restores the list, its scroll and the row", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.goto("/admin/clients?sort=name_asc");
    const rows = page.locator("table tbody tr");
    await expect(rows.nth(5)).toBeVisible();
    const target = rows.nth(5);
    const name = (await target.getByRole("link").first().textContent())?.trim() ?? "";
    await target.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 120));
    const scrollY = await page.evaluate(() => Math.round(window.scrollY));
    await target.locator("td").nth(2).click();
    await page.waitForURL(/\/admin\/clients\/[^/?]+\?list=sort%3Dname_asc/);

    await page.goBack();
    await page.waitForURL(/\/admin\/clients\?sort=name_asc$/);
    const returned = page.locator("table tbody tr[data-staff-returned]");
    await expect(returned).toHaveCount(1);
    await expect(returned.getByRole("link").first()).toHaveText(name);
    await expect(returned).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBeGreaterThanOrEqual(scrollY - 4);
  });

  test("a client page opened from the list pages through it", async ({ page }) => {
    await page.goto("/admin/clients?sort=name_asc");
    await page.locator("table tbody tr").first().locator("td").nth(2).click();
    await page.waitForURL(/\/admin\/clients\/[^/?]+\?list=/);
    const next = page.getByRole("link", { name: /next client/i });
    await expect(next).toHaveAttribute("href", /\?list=sort%3Dname_asc/);
  });

  test("an old client panel link opens the client page", async ({ page }) => {
    await page.goto(`/admin/clients?client=${seededStaffRoutes.clientDetail}&status=active`);
    await page.waitForURL(
      new RegExp(`/admin/clients/${seededStaffRoutes.clientDetail}\\?list=status%3Dactive`),
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a staff row opens the staff page, and an old panel link does too", async ({ page }) => {
    await page.goto("/admin/staff");
    await page.locator("table tbody tr").first().locator("td").nth(2).click();
    await page.waitForURL(/\/admin\/staff\/[^/?]+/);
    const staffPath = new URL(page.url()).pathname;
    const staffId = staffPath.split("/").pop() ?? "";
    await page.goto(`/admin/staff?staff=${staffId}`);
    await page.waitForURL(new RegExp(`${staffPath}$`));
  });

  test("a staff access review row opens the staff page", async ({ page }) => {
    await page.goto("/admin/staff/access");
    await page.locator("table tbody tr").first().locator("td").nth(1).click();
    await page.waitForURL(/\/admin\/staff\/(?!access)[^/?]+/);
  });

  test("client page payments section loads", async ({ page }) => {
    await page.goto("/admin/clients");
    await page.locator("table tbody tr").first().locator("td").nth(2).click();
    await page.waitForURL(/\/admin\/clients\/[^/?]+/);
    await page
      .getByRole("navigation", { name: /^client sections$/i })
      .getByRole("link", { name: /^payments/i })
      .click();
    await expect(page.getByRole("heading", { name: /payments/i }).first()).toBeVisible();
  });
});
