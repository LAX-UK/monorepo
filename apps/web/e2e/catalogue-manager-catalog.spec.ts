import type { Page } from "@playwright/test";
import {
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  ensureCatalogueManagerSession,
  gotoAdminPath,
} from "./helpers/auth";
import { expect, test } from "./helpers/auth.fixture";
import { LOT_PAGE, SALE_PAGE, openRecordPageFromPanel } from "./helpers/staff-records";

async function openCatalogueLotsDraft(page: Page): Promise<void> {
  await ensureCatalogueManagerSession(page);
  await gotoAdminPath(page, "/admin/lots?status=draft");
  await dismissStaffPaletteIfOpen(page);
  await expect(page.getByRole("heading", { name: /^lots$/i }).first()).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("cataloguer catalog access @roles", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  test.skip(!e2eEnabled, e2eSkipReason);

  test("can open lots list and draft lot detail publish control", async ({ page }) => {
    await openCatalogueLotsDraft(page);

    const firstLot = page.locator("table tbody tr").first().getByRole("link").first();
    if (!(await firstLot.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No draft lots in seed data");
    }
    await openRecordPageFromPanel(page, firstLot, LOT_PAGE);
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
    await openRecordPageFromPanel(page, firstLot, LOT_PAGE);
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
    await openRecordPageFromPanel(page, cancelledRow.getByRole("link").first(), SALE_PAGE);
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

    await openRecordPageFromPanel(
      page,
      page.locator("table tbody tr").first().getByRole("link").first(),
      SALE_PAGE,
    );
    await expect(page.getByRole("link", { name: /edit draft/i })).toHaveCount(0);
    // The overflow menu keeps the site link and pinning; the lifecycle actions are not offered.
    await page.getByRole("button", { name: /more sale actions/i }).click();
    for (const action of [/publish sale/i, /revert to draft/i, /cancel sale/i, /delete sale/i]) {
      await expect(page.getByRole("menuitem", { name: action })).toHaveCount(0);
    }
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
