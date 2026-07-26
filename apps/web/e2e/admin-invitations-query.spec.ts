/**
 * Admin invitations list smoke (Query + nuqs pilot).
 */
import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials } from "./helpers/auth";

test.describe("admin invitations (query + nuqs) @journey", () => {
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);

  test("invitations page loads with filters and table shell", async ({ page }) => {
    await page.goto("/admin/invitations");
    await expect(page.getByRole("heading", { name: /^invitations$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /sent invitations/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /invite users/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search by email/i)).toBeVisible();
  });

  test("invite users opens modal with role controls", async ({ page }) => {
    await page.goto("/admin/invitations");
    await page.getByRole("button", { name: /invite users/i }).click();
    await expect(page.getByRole("dialog", { name: /invite users/i })).toBeVisible();
    await expect(page.getByLabel(/invitation role/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^client$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^staff$/i })).toBeVisible();
  });

  test("status filter updates URL via nuqs", async ({ page }) => {
    await page.goto("/admin/invitations");
    await page
      .getByRole("button", { name: /views|filters/i })
      .first()
      .click();
    await page.getByLabel(/invitation status/i).click();
    await page.getByRole("option", { name: /^pending$/i }).click();
    await expect(page).toHaveURL(/status=pending/);
  });

  test("search submits q param to URL", async ({ page }) => {
    await page.goto("/admin/invitations");
    const search = page.getByPlaceholder(/search by email/i);
    await search.fill("test@example.com");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=test/);
    await expect(page).toHaveURL(/offset=/);
  });
});
