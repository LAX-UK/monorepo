/**
 * Admin invitations list smoke (Query + nuqs pilot).
 *
 * Requires PLAYWRIGHT_E2E=1 and staff credentials with invitations access.
 *
 * Run: PLAYWRIGHT_E2E=1 pnpm --filter @auction/web test:e2e -- e2e/admin-invitations-query.spec.ts
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

test.describe("admin invitations (query + nuqs)", () => {
  test("invitations page loads with filters and table shell", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/invitations");
    await expect(page.getByRole("heading", { name: /^invitations$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /sent invitations/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search by email/i)).toBeVisible();
  });

  test("status filter updates URL via nuqs", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
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
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/invitations");
    const search = page.getByPlaceholder(/search by email/i);
    await search.fill("test@example.com");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=test/);
    await expect(page).toHaveURL(/offset=/);
  });
});
