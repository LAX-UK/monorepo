import { expect, test } from "@playwright/test";
import {
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  expectNoSeriousAxeViolationsInMain,
} from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";

async function openAdminHome(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await dismissStaffPaletteIfOpen(page);
}

test.describe("admin dashboard oversight @roles", () => {
  test.use({ storageState: roleAuthState.staff });
  test.skip(!e2eEnabled, e2eSkipReason);

  test("super admin sees finance primary action and work inbox", async ({ page }) => {
    await openAdminHome(page);
    await expect(page.getByRole("heading", { name: /good day/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /finance hub/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /work inbox/i })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: /work inbox/i })).toHaveCount(0);
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
    await expect(page.getByRole("heading", { name: /work inbox/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });
});

test.describe("admin dashboard inline action permissions @roles", () => {
  test.use({ storageState: roleAuthState.readonlyStaff });

  test.skip(!e2eEnabled, e2eSkipReason);

  test("read-only staff does not see capture or assign bulk actions on inbox", async ({ page }) => {
    await openAdminHome(page);
    const inbox = page.getByRole("heading", { name: /work inbox/i });
    await expect(inbox).toBeVisible();
    await expect(page.getByRole("button", { name: /^capture$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /assign to me/i })).toHaveCount(0);
  });
});
