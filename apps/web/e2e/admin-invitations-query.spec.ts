/**
 * Admin invitations list smoke (Query + nuqs pilot).
 */
import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials } from "./helpers/auth";

test.describe("admin invitations (query + nuqs) @journey", () => {
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);

  test("invitations page loads with views and table shell", async ({ page }) => {
    await page.goto("/admin/invitations");
    await expect(page.getByRole("heading", { name: /^invitations$/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /^invite people$/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: /^views$/i })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: /search invitations/i })).toBeVisible();
  });

  test("invite people opens a dialog with the role choice", async ({ page }) => {
    await page.goto("/admin/invitations");
    await page.getByRole("button", { name: /^invite people$/i }).click();
    const dialog = page.getByRole("dialog", { name: /invite people/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: /^client\b/i })).toBeVisible();
    await expect(dialog.getByRole("radio", { name: /^staff\b/i })).toBeVisible();
  });

  test("status view updates URL via nuqs", async ({ page }) => {
    await page.goto("/admin/invitations");
    await page
      .getByRole("navigation", { name: /^views$/i })
      .getByRole("link", { name: /^pending/i })
      .click();
    await expect(page).toHaveURL(/status=pending/);
  });

  test("search submits q param to URL", async ({ page }) => {
    await page.goto("/admin/invitations");
    const search = page.getByRole("searchbox", { name: /search invitations/i });
    await search.fill("test@example.com");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=test/);
    await expect(page).toHaveURL(/offset=/);
  });
});
