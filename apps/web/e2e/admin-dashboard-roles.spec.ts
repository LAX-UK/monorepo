import { expect, test } from "@playwright/test";
import {
  e2eEnabled,
  e2eSkipReason,
  expectNoSeriousAxeViolationsInMain,
  staffLogin,
} from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";

test.describe("admin dashboard oversight @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("super admin sees finance primary action and work inbox", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /your dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /finance hub/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /work inbox/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });
});

test.describe("admin dashboard finance @roles", () => {
  test.use({ storageState: roleAuthState.finance });

  test.skip(!e2eEnabled, e2eSkipReason);

  test("finance ops sees payments primary action without saleroom radar", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /review payments/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /work inbox/i })).toBeVisible();
    await expect(page.getByText(/onsite radar/i)).toHaveCount(0);
    await expectNoSeriousAxeViolationsInMain(page);
  });
});

test.describe("admin dashboard read-only @roles", () => {
  test.use({ storageState: roleAuthState.readonlyStaff });

  test.skip(!e2eEnabled, e2eSkipReason);

  test("read-only staff sees browse lots and no mutation CTAs in greeting", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /browse lots/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /new lot/i })).toHaveCount(0);
    await expectNoSeriousAxeViolationsInMain(page);
  });
});

test.describe("admin dashboard operations @roles", () => {
  test.use({ storageState: roleAuthState.operations });

  test.skip(!e2eEnabled, e2eSkipReason);

  test("auction operations sees saleroom primary action", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /open saleroom/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /work inbox/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });
});

test.describe("admin dashboard inline action permissions @roles", () => {
  test.use({ storageState: roleAuthState.readonlyStaff });

  test.skip(!e2eEnabled, e2eSkipReason);

  test("read-only staff does not see capture or assign bulk actions on inbox", async ({ page }) => {
    await page.goto("/admin");
    const inbox = page.getByRole("heading", { name: /work inbox/i });
    await expect(inbox).toBeVisible();
    await expect(page.getByRole("button", { name: /^capture$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /assign to me/i })).toHaveCount(0);
  });
});
