import { type Page, expect, test } from "@playwright/test";
import {
  assertAuthenticatedStaffSession,
  e2eEnabled,
  ensureAuthenticatedStaffSession,
  hasStaffCredentials,
  seededStaffRoutes,
  stabilizeVisualPage,
} from "./helpers/auth";

const visualEnabled = process.env.PLAYWRIGHT_VISUAL === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_VISUAL=1, seeded staff credentials, and start a production build.";
const canRunVisual = e2eEnabled && visualEnabled && hasStaffCredentials();

const listRoutes = [
  { path: "/admin", slug: "admin-home" },
  { path: "/admin/lots", slug: "admin-lots" },
  { path: "/admin/sales", slug: "admin-sales" },
  { path: "/admin/submissions", slug: "admin-submissions" },
  { path: "/admin/categories", slug: "admin-categories" },
  { path: "/admin/artists", slug: "admin-artists" },
  { path: "/admin/venues", slug: "admin-venues" },
  { path: "/admin/payments", slug: "admin-payments" },
  { path: "/admin/payments?manualReview=1", slug: "admin-payments-manual-review" },
  { path: "/admin/finance", slug: "admin-finance" },
  { path: "/admin/disputes", slug: "admin-disputes" },
  { path: "/admin/disputes?status=open", slug: "admin-disputes-open" },
  { path: "/admin/payouts", slug: "admin-payouts" },
  { path: "/admin/payouts/settlement", slug: "admin-payouts-settlement" },
  { path: "/admin/compliance/aml", slug: "admin-compliance-aml" },
  { path: "/admin/compliance/source-of-funds", slug: "admin-compliance-sof" },
  { path: "/admin/condition-reports", slug: "admin-condition-reports" },
  { path: "/admin/lot-fulfilment", slug: "admin-lot-fulfilment" },
  { path: "/admin/onboarding-issues", slug: "admin-onboarding-issues" },
  { path: "/admin/invitations", slug: "admin-invitations" },
  { path: "/admin/clients", slug: "admin-clients" },
  { path: "/admin/staff", slug: "admin-staff" },
  { path: "/admin/legal-entities", slug: "admin-legal-entities" },
  { path: "/admin/saleroom", slug: "admin-saleroom" },
  { path: "/admin/event-rsvps", slug: "admin-event-rsvps" },
  { path: "/admin/integrations/xero", slug: "admin-xero" },
] as const;

const detailRoutes = [
  // Catalog — lots
  { path: `/admin/lots/${seededStaffRoutes.lotDetail}`, slug: "admin-lot-detail" },
  { path: `/admin/lots/${seededStaffRoutes.lotDetail}/images`, slug: "admin-lot-images-tab" },
  { path: `/admin/lots/${seededStaffRoutes.lotDetail}/documents`, slug: "admin-lot-documents-tab" },
  { path: `/admin/lots/${seededStaffRoutes.lotDetail}/bids`, slug: "admin-lot-bids-tab" },
  { path: `/admin/lots/${seededStaffRoutes.lotDetail}/activity`, slug: "admin-lot-activity-tab" },
  // Catalog — sales
  { path: `/admin/sales/${seededStaffRoutes.saleDetail}`, slug: "admin-sale-detail" },
  { path: `/admin/sales/${seededStaffRoutes.saleDetail}/lots`, slug: "admin-sale-lots-tab" },
  {
    path: `/admin/sales/${seededStaffRoutes.saleDetail}/registrations`,
    slug: "admin-sale-registrations-tab",
  },
  {
    path: `/admin/sales/${seededStaffRoutes.saleDetail}/documents`,
    slug: "admin-sale-documents-tab",
  },
  { path: `/admin/sales/${seededStaffRoutes.saleDetail}/press`, slug: "admin-sale-press-tab" },
  {
    path: `/admin/sales/${seededStaffRoutes.saleDetail}/schedule`,
    slug: "admin-sale-schedule-tab",
  },
  // Catalog — submissions
  {
    path: `/admin/submissions/${seededStaffRoutes.submissionDetail}`,
    slug: "admin-submission-detail",
  },
  {
    path: `/admin/submissions/${seededStaffRoutes.submissionDetail}/documents`,
    slug: "admin-submission-documents-tab",
  },
  {
    path: `/admin/submissions/${seededStaffRoutes.submissionDetail}/decision`,
    slug: "admin-submission-decision-tab",
  },
  // Catalog — taxonomy
  {
    path: `/admin/categories/${seededStaffRoutes.categoryDetail}`,
    slug: "admin-category-detail",
  },
  {
    path: `/admin/categories/${seededStaffRoutes.categoryDetail}/children`,
    slug: "admin-category-children-tab",
  },
  {
    path: `/admin/categories/${seededStaffRoutes.categoryDetail}/lots`,
    slug: "admin-category-lots-tab",
  },
  {
    path: `/admin/categories/${seededStaffRoutes.categoryDetail}/sales`,
    slug: "admin-category-sales-tab",
  },
  {
    path: `/admin/categories/${seededStaffRoutes.categoryDetail}/activity`,
    slug: "admin-category-activity-tab",
  },
  {
    path: `/admin/categories/${seededStaffRoutes.categoryDetail}/edit`,
    slug: "admin-category-edit",
  },
  { path: `/admin/artists/${seededStaffRoutes.artistDetail}`, slug: "admin-artist-detail" },
  {
    path: `/admin/artists/${seededStaffRoutes.artistDetail}/lots`,
    slug: "admin-artist-lots-tab",
  },
  {
    path: `/admin/artists/${seededStaffRoutes.artistDetail}/duplicates`,
    slug: "admin-artist-duplicates-tab",
  },
  // People & compliance
  { path: `/admin/clients/${seededStaffRoutes.clientDetail}`, slug: "admin-client-detail" },
  {
    path: `/admin/clients/${seededStaffRoutes.clientDetail}?tab=won-lots`,
    slug: "admin-client-won-lots-tab",
  },
  {
    path: `/admin/clients/${seededStaffRoutes.clientDetail}?tab=bids`,
    slug: "admin-client-bids-tab",
  },
  {
    path: `/admin/clients/${seededStaffRoutes.clientDetail}?tab=payments`,
    slug: "admin-client-payments-tab",
  },
  { path: `/admin/staff/${seededStaffRoutes.staffDetail}`, slug: "admin-staff-detail" },
  {
    path: `/admin/staff/${seededStaffRoutes.staffDetail}?tab=permissions`,
    slug: "admin-staff-permissions-tab",
  },
  {
    path: `/admin/legal-entities/${seededStaffRoutes.legalEntityDetail}`,
    slug: "admin-legal-entity-detail",
  },
  {
    path: `/admin/legal-entities/${seededStaffRoutes.legalEntityDetail}/documents`,
    slug: "admin-legal-entity-documents-tab",
  },
  {
    path: `/admin/legal-entities/${seededStaffRoutes.legalEntityDetail}/compliance`,
    slug: "admin-legal-entity-compliance-tab",
  },
  {
    path: `/admin/legal-entities/${seededStaffRoutes.legalEntityDetail}/stripe`,
    slug: "admin-legal-entity-stripe-tab",
  },
  {
    path: `/admin/legal-entities/${seededStaffRoutes.legalEntityDetail}/activity`,
    slug: "admin-legal-entity-activity-tab",
  },
  {
    path: `/admin/compliance/source-of-funds/${seededStaffRoutes.sofCaseDetail}`,
    slug: "admin-sof-detail",
  },
  // Operations — event RSVPs
  {
    path: `/admin/event-rsvps/${seededStaffRoutes.eventRsvpSlug}`,
    slug: "admin-event-rsvp-detail",
    ready: async (page: Page) => {
      const missing = page.getByText(/could not load onsite event/i);
      if (await missing.isVisible({ timeout: 5_000 }).catch(() => false)) {
        test.skip(true, "Seeded event RSVP slug not available");
      }
    },
  },
  {
    path: `/admin/event-rsvps/${seededStaffRoutes.eventRsvpSlug}/check-in`,
    slug: "admin-event-rsvp-check-in",
    ready: async (page: Page) => {
      const missing = page.getByText(/not found/i);
      if (await missing.isVisible({ timeout: 5_000 }).catch(() => false)) {
        test.skip(true, "Seeded event check-in slug not available");
      }
    },
  },
  // Forms & lenses
  { path: "/admin/lots/new", slug: "admin-lot-new" },
  { path: "/admin/sales/new", slug: "admin-sale-new" },
  { path: "/admin/lots?lens=attention", slug: "admin-lots-attention" },
] as const;

const visualDrawerTimeout = 30_000;

/** Waits for Radix sheet/dialog to mount after client hydration on deep-linked list routes. */
async function waitForVisualDrawer(page: Page, content?: RegExp | string): Promise<void> {
  const dialog = content
    ? page.getByRole("dialog").filter({ hasText: content })
    : page.getByRole("dialog").last();
  await expect(dialog).toBeVisible({ timeout: visualDrawerTimeout });
  if (content) {
    await expect(dialog.getByText(content).first()).toBeVisible({ timeout: 15_000 });
  }
}

const drawerRoutes = [
  {
    path: `/admin/clients?client=${seededStaffRoutes.clientDetail}`,
    slug: "admin-clients-drawer",
    ready: async (page: Page) => {
      await waitForVisualDrawer(page, /Victoria Harrington|Overview/i);
    },
  },
  {
    path: `/admin/legal-entities?entity=${seededStaffRoutes.legalEntityDrawer}`,
    slug: "admin-legal-entities-drawer",
    ready: async (page: Page) => {
      await waitForVisualDrawer(page, /Robert Thorne/);
    },
  },
  {
    path: `/admin/invitations?invitation=${seededStaffRoutes.invitationDrawer}`,
    slug: "admin-invitations-drawer",
    ready: async (page: Page) => {
      await waitForVisualDrawer(page, /new-accountant@example.com|Preview/i);
    },
  },
  {
    path: "/admin/disputes?status=open",
    slug: "admin-disputes-drawer",
    ready: async (page: Page) => {
      const openCase = page.getByRole("button", { name: /view case/i }).first();
      if (!(await openCase.isVisible().catch(() => false))) {
        test.skip(true, "No open disputes in seed data");
      }
      await openCase.click();
      await waitForVisualDrawer(page, /Dispute case/i);
    },
  },
  {
    path: "/admin/lots",
    slug: "admin-lots-filters-sheet",
    ready: async (page: Page) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      const filters = page.getByRole("button", { name: /^filters$/i });
      await expect(filters).toBeVisible({ timeout: visualDrawerTimeout });
      await filters.click();
      await waitForVisualDrawer(page, /Apply filters/);
    },
  },
  {
    path: "/admin/categories?new=1",
    slug: "admin-categories-create-sheet",
    ready: async (page: Page) => {
      await waitForVisualDrawer(page, /new category/i);
    },
  },
] as const;

const viewports = [
  { id: "desktop", width: 1440, height: 1000 },
  { id: "constrained-desktop", width: 1023, height: 900 },
  { id: "mobile", width: 390, height: 844 },
] as const;

async function captureVisualBaseline(
  page: Page,
  slug: string,
  viewportId: string,
  colorScheme: "light" | "dark",
): Promise<void> {
  await assertAuthenticatedStaffSession(page);
  await stabilizeVisualPage(page);
  await expect(page).toHaveScreenshot(`${slug}-${viewportId}-${colorScheme}.png`, {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
    mask: [page.locator("time")],
  });
}

test.describe("admin rollout visual gate", () => {
  test.setTimeout(120_000);
  test.skip(!canRunVisual, skipReason);

  for (const colorScheme of ["light", "dark"] as const) {
    for (const viewport of viewports) {
      test.describe(`${colorScheme} ${viewport.id}`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        });

        for (const route of listRoutes) {
          test(`${route.path} list visual baseline`, async ({ page }) => {
            const response = await page.goto(route.path);
            expect(response?.ok()).toBeTruthy();
            await ensureAuthenticatedStaffSession(page);
            await expect(page.locator("#main-content")).toBeVisible();
            await captureVisualBaseline(page, route.slug, viewport.id, colorScheme);
          });
        }

        for (const route of detailRoutes) {
          test(`${route.path} detail visual baseline`, async ({ page }) => {
            const response = await page.goto(route.path);
            expect(response?.ok()).toBeTruthy();
            await ensureAuthenticatedStaffSession(page);
            await expect(page.locator("#main-content")).toBeVisible();
            if ("ready" in route && route.ready) {
              await route.ready(page);
            }
            await captureVisualBaseline(page, route.slug, viewport.id, colorScheme);
          });
        }

        for (const route of drawerRoutes) {
          test(`${route.path} drawer visual baseline`, async ({ page }) => {
            const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
            expect(response?.ok()).toBeTruthy();
            await ensureAuthenticatedStaffSession(page);
            await expect(page.locator("#main-content")).toBeVisible({
              timeout: visualDrawerTimeout,
            });
            await route.ready(page);
            await captureVisualBaseline(page, route.slug, viewport.id, colorScheme);
          });
        }
      });
    }
  }
});
