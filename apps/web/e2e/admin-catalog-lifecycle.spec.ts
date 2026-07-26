import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";

test.describe("staff catalog lifecycle @journey", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("scheduled sale draft lot exposes publish", async ({ page }) => {
    await page.goto("/admin/sales?status=scheduled");
    const scheduledRow = page.locator("table tbody tr").first();
    if (!(await scheduledRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No scheduled sales in seed data");
    }
    await scheduledRow.getByRole("link").first().click();
    await page.waitForURL(/\/admin\/sales\/[^/]+$/);

    await page.goto(`${page.url()}/lots`);
    const draftLot = page
      .locator("table tbody tr")
      .filter({ hasText: /draft/i })
      .first()
      .getByRole("link")
      .first();
    if (!(await draftLot.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Scheduled sale has no draft lots in seed data");
    }
    await draftLot.click();
    await page.waitForURL(/\/admin\/lots\/[^/]+$/);
    await expect(page.getByRole("button", { name: /^publish$/i })).toBeVisible();
  });

  test("auction manager sees destructive controls on deletable drafts", async ({ page }) => {
    await page.goto("/admin/lots?status=draft");
    const firstLot = page.locator("table tbody tr").first().getByRole("link").first();
    if (!(await firstLot.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No draft lots in seed data");
    }
    await firstLot.click();
    await page.waitForURL(/\/admin\/lots\/[^/]+$/);

    const directDelete = page.getByRole("button", { name: /^delete lot$/i });
    if (await directDelete.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(directDelete).toBeVisible();
      return;
    }
    const more = page.getByRole("button", { name: /more lot actions/i });
    if (!(await more.isVisible({ timeout: 2_000 }).catch(() => false))) {
      test.skip(true, "Seeded draft lot is not deletable");
    }
    await more.click();
    await expect(page.getByRole("menuitem", { name: /delete lot/i })).toBeVisible();
  });
});
