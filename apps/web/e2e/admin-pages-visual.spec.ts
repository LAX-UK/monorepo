import { expect, test } from "@playwright/test";
import { e2eEnabled, hasStaffCredentials, stabilizeVisualPage, staffLogin } from "./helpers/auth";

const visualEnabled = process.env.PLAYWRIGHT_VISUAL === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_VISUAL=1, seeded staff credentials, and start a production build.";

const routes = [
  { path: "/admin", slug: "admin-home" },
  { path: "/admin/lots", slug: "admin-lots" },
  { path: "/admin/sales", slug: "admin-sales" },
  { path: "/admin/categories", slug: "admin-categories" },
  { path: "/admin/payments", slug: "admin-payments" },
  { path: "/admin/disputes", slug: "admin-disputes" },
  { path: "/admin/payouts", slug: "admin-payouts" },
  { path: "/admin/payouts/settlement", slug: "admin-payouts-settlement" },
  { path: "/admin/compliance/aml", slug: "admin-compliance-aml" },
  { path: "/admin/compliance/source-of-funds", slug: "admin-compliance-sof" },
  { path: "/admin/invitations", slug: "admin-invitations" },
  { path: "/admin/clients", slug: "admin-clients" },
  { path: "/admin/staff", slug: "admin-staff" },
  { path: "/admin/legal-entities", slug: "admin-legal-entities" },
  { path: "/admin/onboarding-issues", slug: "admin-onboarding-issues" },
] as const;

const viewports = [
  { id: "desktop", width: 1440, height: 1000 },
  { id: "constrained-desktop", width: 1023, height: 900 },
  { id: "mobile", width: 390, height: 844 },
] as const;

test.describe("admin rollout visual gate", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  for (const colorScheme of ["light", "dark"] as const) {
    for (const viewport of viewports) {
      test.describe(`${colorScheme} ${viewport.id}`, () => {
        test.beforeEach(async ({ page }) => {
          test.skip(!e2eEnabled || !visualEnabled || !hasStaffCredentials(), skipReason);
          await page.setViewportSize(viewport);
          await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
          await staffLogin(page);
        });

        for (const route of routes) {
          test(`${route.path} visual baseline`, async ({ page }) => {
            const response = await page.goto(route.path);
            expect(response?.ok()).toBeTruthy();
            await expect(page.locator("#main-content")).toBeVisible();
            await stabilizeVisualPage(page);

            await expect(page).toHaveScreenshot(`${route.slug}-${viewport.id}-${colorScheme}.png`, {
              fullPage: true,
              maxDiffPixelRatio: 0.01,
              mask: [page.locator("time")],
            });
          });
        }
      });
    }
  }
});
