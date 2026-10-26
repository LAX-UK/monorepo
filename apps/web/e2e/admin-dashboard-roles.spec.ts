import {
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  expectNoSeriousAxeViolationsInMain,
  gotoAdminPath,
} from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import { expect, test } from "./helpers/auth.fixture";

async function openAdminHome(page: import("@playwright/test").Page): Promise<void> {
  await gotoAdminPath(page, "/admin");
  await dismissStaffPaletteIfOpen(page);
}

test.describe("admin dashboard oversight @roles", () => {
  test.use({ storageState: roleAuthState.staffRoles });
  test.skip(!e2eEnabled, e2eSkipReason);

  test("super admin sees finance primary action and work inbox", async ({ page }) => {
    await openAdminHome(page);
    await expect(page.getByRole("heading", { name: /good day/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /finance hub/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^your work$/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });
});

test.describe("admin dashboard finance @roles", () => {
  test.use({ storageState: roleAuthState.finance });

  test.skip(!e2eEnabled, e2eSkipReason);

  test("finance ops sees payments primary action without saleroom radar", async ({ page }) => {
    await openAdminHome(page);
    await expect(page).toHaveURL(/\/admin\/finance(?:\?|$)/);
    await expect(page.getByRole("heading", { name: /^finance$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^payments$/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /^your work$/i })).toHaveCount(0);
    await expect(page.getByText(/onsite radar/i)).toHaveCount(0);
    await expectNoSeriousAxeViolationsInMain(page);
  });
});

test.describe("admin dashboard read-only @roles", () => {
  test.use({ storageState: roleAuthState.readonlyStaff });

  test.skip(!e2eEnabled, e2eSkipReason);

  test("read-only staff sees browse lots and no mutation CTAs in greeting", async ({ page }) => {
    await openAdminHome(page);
    await expect(page.getByRole("link", { name: /browse lots/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^new lot$/i })).toHaveCount(0);
    await expectNoSeriousAxeViolationsInMain(page);
  });
});

test.describe("admin dashboard operations @roles", () => {
  test.use({ storageState: roleAuthState.operations });

  test.skip(!e2eEnabled, e2eSkipReason);

  test("auction operations sees saleroom primary action", async ({ page }) => {
    await openAdminHome(page);
    await expect(page.getByRole("link", { name: /open saleroom/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^your work$/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });
});

test.describe("admin dashboard inline action permissions @roles", () => {
  test.use({ storageState: roleAuthState.readonlyStaff });

  test.skip(!e2eEnabled, e2eSkipReason);

  test("read-only staff does not see capture or assign bulk actions on inbox", async ({ page }) => {
    await openAdminHome(page);
    const inbox = page.getByRole("heading", { name: /^your work$/i });
    await expect(inbox).toBeVisible();
    const forbidden = /^(capture|capture payment|assign to me)$/i;
    // Nothing on the page offers them directly.
    await expect(page.getByRole("button", { name: forbidden })).toHaveCount(0);
    // Each row's actions live in its menu: none may offer capture or assign.
    const table = page.getByRole("table", { name: /^your work$/i });
    const menus = table.getByRole("button", { name: /^actions for /i });
    const rows = Math.min(await menus.count(), 5);
    for (let index = 0; index < rows; index += 1) {
      await menus.nth(index).click();
      await expect(page.getByRole("menu")).toBeVisible();
      await expect(page.getByRole("menuitem", { name: forbidden })).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
    // Selecting a row must not bring capture or assign into the bulk bar either.
    const select = table.getByRole("checkbox").nth(1);
    if ((await select.count()) > 0 && (await select.isVisible())) {
      await select.check();
      await expect(page.getByRole("button", { name: forbidden })).toHaveCount(0);
    }
  });
});
