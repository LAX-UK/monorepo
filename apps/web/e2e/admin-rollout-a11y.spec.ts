import { expect, test } from "@playwright/test";
import {
  e2eEnabled,
  e2eSkipReason,
  expectNoSeriousAxeViolationsInMain,
  hasStaffCredentials,
  staffLogin,
} from "./helpers/auth";

test.describe("admin rollout accessibility gate", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);
    await staffLogin(page);
  });

  for (const route of [
    "/admin",
    "/admin/lots",
    "/admin/sales",
    "/admin/categories",
    "/admin/payments",
    "/admin/disputes",
    "/admin/payouts",
    "/admin/payouts/settlement",
    "/admin/compliance/aml",
    "/admin/compliance/source-of-funds",
    "/admin/invitations",
    "/admin/clients",
    "/admin/staff",
    "/admin/legal-entities",
    "/admin/onboarding-issues",
  ]) {
    test(`${route} passes serious axe checks in dark mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
      await expectNoSeriousAxeViolationsInMain(page);
    });
  }

  test("catalog lists pass at the constrained desktop breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 900 });
    for (const route of [
      "/admin/lots",
      "/admin/sales",
      "/admin/categories",
      "/admin/invitations",
      "/admin/clients",
      "/admin/staff",
      "/admin/legal-entities",
      "/admin/onboarding-issues",
    ]) {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
      await expectNoSeriousAxeViolationsInMain(page);
    }
  });

  test("lot images Add and Manage states pass axe checks", async ({ page }) => {
    await page.goto("/admin/lots");
    const lotHref = (
      await page
        .locator('a[href^="/admin/lots/"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")))
    ).find(
      (href) => href != null && /^\/admin\/lots\/[^/]+$/.test(href) && href !== "/admin/lots/new",
    );
    if (!lotHref) {
      test.skip(true, "Seed a lot to exercise media states.");
      return;
    }

    await page.goto(`${lotHref}/images`);
    await expect(page.locator("#main-content")).toBeVisible();
    const add = page.getByRole("button", { name: /add images/i });
    if (await add.isVisible().catch(() => false)) {
      await add.click();
      await expectNoSeriousAxeViolationsInMain(page);
    }
    const manage = page.getByRole("button", { name: /^manage$/i });
    if (await manage.isVisible().catch(() => false)) {
      await manage.click();
      await expectNoSeriousAxeViolationsInMain(page);
    }
  });
});
