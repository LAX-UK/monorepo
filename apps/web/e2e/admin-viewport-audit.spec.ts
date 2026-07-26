import { expect, test } from "@playwright/test";
import { e2eEnabled, hasStaffCredentials, seededStaffRoutes, staffLogin } from "./helpers/auth";

const skipReason = "Set PLAYWRIGHT_E2E=1, seeded staff credentials, and start a production build.";

const VIEWPORTS = [
  { width: 390, height: 844, label: "mobile" },
  { width: 1023, height: 900, label: "constrained-desktop" },
  { width: 1440, height: 1000, label: "desktop" },
] as const;

const LIST_ROUTES = [
  "/admin",
  "/admin/lots",
  "/admin/sales",
  "/admin/submissions",
  "/admin/categories",
  "/admin/artists",
  "/admin/venues",
  "/admin/clients",
  "/admin/staff",
  "/admin/legal-entities",
  "/admin/invitations",
  "/admin/payments",
  "/admin/payments?manualReview=1",
  "/admin/disputes",
  "/admin/payouts",
  "/admin/payouts/settlement",
  "/admin/finance",
  "/admin/compliance/aml",
  "/admin/compliance/source-of-funds",
  "/admin/condition-reports",
  "/admin/lot-fulfilment",
  "/admin/onboarding-issues",
  "/admin/saleroom",
  "/admin/event-rsvps",
  "/admin/integrations/xero",
] as const;

const DETAIL_ROUTES = [
  `/admin/lots/${seededStaffRoutes.lotDetail}`,
  `/admin/sales/${seededStaffRoutes.saleDetail}`,
  `/admin/clients/${seededStaffRoutes.clientDetail}`,
  `/admin/compliance/source-of-funds/${seededStaffRoutes.sofCaseDetail}`,
  "/admin/lots/new",
  "/admin/sales/new",
] as const;

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth <= doc.clientWidth + 1;
  });
  expect(overflow).toBe(true);
}

test.describe("admin viewport audit", () => {
  test.describe.configure({ mode: "serial" });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.label} — no horizontal overflow on staff list routes`, async ({ page }) => {
      test.skip(!e2eEnabled || !hasStaffCredentials(), skipReason);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await staffLogin(page);

      for (const path of LIST_ROUTES) {
        const response = await page.goto(path);
        expect(response?.ok()).toBeTruthy();
        await page.locator("#main-content").waitFor({ state: "visible" });
        await assertNoHorizontalOverflow(page);
      }
    });

    test(`${viewport.label} — no horizontal overflow on staff detail routes`, async ({ page }) => {
      test.skip(!e2eEnabled || !hasStaffCredentials(), skipReason);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await staffLogin(page);

      for (const path of DETAIL_ROUTES) {
        const response = await page.goto(path);
        expect(response?.ok()).toBeTruthy();
        await page.locator("#main-content").waitFor({ state: "visible" });
        await assertNoHorizontalOverflow(page);
      }
    });
  }

  test("mobile preview drawers do not overflow horizontally", async ({ page }) => {
    test.skip(!e2eEnabled || !hasStaffCredentials(), skipReason);
    await page.setViewportSize({ width: 390, height: 844 });
    await staffLogin(page);

    await page.goto(`/admin/clients?client=${seededStaffRoutes.clientDetail}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto(`/admin/legal-entities?entity=${seededStaffRoutes.legalEntityDrawer}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("mobile filters sheet on lots list does not overflow horizontally", async ({ page }) => {
    test.skip(!e2eEnabled || !hasStaffCredentials(), skipReason);
    await page.setViewportSize({ width: 390, height: 844 });
    await staffLogin(page);
    await page.goto("/admin/lots");
    await page.getByRole("button", { name: /^filters$/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
