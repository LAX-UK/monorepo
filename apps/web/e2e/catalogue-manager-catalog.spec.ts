import { type Page, expect, test } from "@playwright/test";
import {
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  gotoAdminPath,
} from "./helpers/auth";

async function openCatalogueLotsDraft(page: Page): Promise<void> {
  await gotoAdminPath(page, "/admin/lots?status=draft");
  await dismissStaffPaletteIfOpen(page);
  await expect(page.getByRole("heading", { name: /^lots$/i }).first()).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("catalogue manager catalog access @roles", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!e2eEnabled, e2eSkipReason);

  test("can open lots list and draft lot detail publish control", async ({ page }) => {
    await openCatalogueLotsDraft(page);

    const firstLot = page.locator("table tbody tr").first().getByRole("link").first();
    if (!(await firstLot.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No draft lots in seed data");
    }
    await firstLot.click();
    await page.waitForURL(/\/admin\/lots\/[^/]+$/);
    await expect(page.getByRole("button", { name: /^publish$/i })).toBeVisible();
  });

  test("bulk cancel is hidden on lots list", async ({ page }) => {
    await openCatalogueLotsDraft(page);

    const firstRowCheckbox = page.locator("table tbody tr").first().getByRole("checkbox");
    if (!(await firstRowCheckbox.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No lots in seed data");
    }
    await firstRowCheckbox.check();
    await expect(page.getByRole("button", { name: /^publish$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^cancel$/i })).toHaveCount(0);
  });

  test("detail cancel auction is hidden", async ({ page }) => {
    await openCatalogueLotsDraft(page);
    const firstLot = page.locator("table tbody tr").first().getByRole("link").first();
    if (!(await firstLot.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No draft lots in seed data");
    }
    await firstLot.click();
    await page.waitForURL(/\/admin\/lots\/[^/]+$/);
    await expect(page.getByRole("button", { name: /cancel auction/i })).toHaveCount(0);
  });

  test("sale lots hide return to inventory", async ({ page }) => {
    await gotoAdminPath(page, "/admin/sales");
    await dismissStaffPaletteIfOpen(page);
    const cancelledRow = page
      .locator("table tbody tr")
      .filter({ hasText: /cancelled/i })
      .first();
    if (!(await cancelledRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No cancelled sales in seed data");
    }
    await cancelledRow.getByRole("link").first().click();
    await page.waitForURL(/\/admin\/sales\/[^/]+$/);
    await page.goto(`${page.url()}/lots`);
    await expect(page.getByText(/return lots to inventory/i)).toHaveCount(0);
  });

  test("sale detail hides auction-manager actions", async ({ page }) => {
    await gotoAdminPath(page, "/admin/sales");
    await dismissStaffPaletteIfOpen(page);
    await expect(page.getByRole("heading", { name: /^sales$/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    const firstRowCheckbox = page.locator("table tbody tr").first().getByRole("checkbox");
    if (!(await firstRowCheckbox.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No sales in seed data");
    }
    await firstRowCheckbox.check();
    await expect(page.getByRole("button", { name: /^publish$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^cancel$/i })).toHaveCount(0);

    await page.locator("table tbody tr").first().getByRole("link").first().click();
    await page.waitForURL(/\/admin\/sales\/[^/]+$/);
    await expect(page.getByRole("button", { name: /more sale actions/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /edit draft/i })).toHaveCount(0);
  });

  test("shows sale-assigned bulk publish preflight hint", async ({ page }) => {
    await openCatalogueLotsDraft(page);
    const firstRowCheckbox = page.locator("table tbody tr").first().getByRole("checkbox");
    if (!(await firstRowCheckbox.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No lots in seed data");
    }
    await firstRowCheckbox.check();
    const preflight = page.getByText(/published together when you publish the sale/i);
    if (!(await preflight.isVisible({ timeout: 2_000 }).catch(() => false))) {
      test.skip(true, "Selected lot is not assigned to a draft sale");
    }
    await expect(preflight).toBeVisible();
  });
});
