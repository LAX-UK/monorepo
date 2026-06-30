/**
 * Admin disputes list smoke (Query + nuqs pilot).
 *
 * Requires PLAYWRIGHT_E2E=1 and staff credentials with finance/disputes access.
 *
 * Run: PLAYWRIGHT_E2E=1 pnpm --filter @auction/web test:e2e -- e2e/admin-disputes-query.spec.ts
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

test.describe("admin disputes (query + nuqs)", () => {
  test("disputes page loads with status chips and table shell", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/disputes");
    await expect(page.getByRole("heading", { name: /payment disputes/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^open$/i })).toBeVisible();
  });

  test("status filter updates URL", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/disputes");
    await page.getByRole("link", { name: /^open$/i }).click();
    await expect(page).toHaveURL(/status=open/);
    await expect(page).toHaveURL(/offset=/);
  });

  test("pagination updates offset via nuqs when next is available", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/disputes?limit=1&offset=0");
    const next = page.getByRole("button", { name: /next page/i });
    if (await next.isVisible()) {
      await next.click();
      await expect(page).toHaveURL(/offset=1/);
    }
  });
});
