import { expect, test } from "@playwright/test";
import {
  type AdminSessionFeatures,
  requireFeatureOrSkip,
  skipStaffFeatureUnlessEnabled,
} from "./support/feature-gate.js";
import { requireStaffAcceptanceCredentials } from "./support/staff-credentials.js";
import { openStaffBrowserSession } from "./support/staff-session.js";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const authBaseUrl = process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid";

type SurfaceRoute = {
  path: string;
  heading: RegExp | string;
  feature?: keyof AdminSessionFeatures;
};

const CORE_ROUTES: SurfaceRoute[] = [
  { path: "/overview", heading: /^Overview$/ },
  { path: "/orders", heading: /^Orders$/ },
  { path: "/clients", heading: /^Clients$/ },
  { path: "/requests", heading: /^Sale limit requests$/ },
  { path: "/fulfilment", heading: /^Fulfilment$/ },
  { path: "/holds", heading: /^Stock holds$/ },
  { path: "/artists", heading: /^Artists$/ },
  { path: "/artworks", heading: /^Artworks$/ },
  { path: "/staff", heading: /^Staff$/ },
  { path: "/production", heading: /^Production tasks$/ },
];

const FLAGGED_ROUTES: SurfaceRoute[] = [
  { path: "/payouts", heading: /^Payouts$/, feature: "payouts" },
  { path: "/third-party-sales", heading: /^Third-party sales$/, feature: "thirdPartySales" },
  { path: "/original-sales", heading: /^Original sales$/, feature: "originalSales" },
  { path: "/merchandise", heading: /^Merchandise$/, feature: "merchandise" },
];

async function assertStaffSurface(
  page: import("@playwright/test").Page,
  baseUrl: string,
  route: SurfaceRoute,
): Promise<void> {
  await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "Could not load" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Access denied" })).toHaveCount(0);
}

test.describe("shop-admin read surfaces @e2e", () => {
  test.setTimeout(300_000);

  test("staff routes render without AdminFetchState failures", async ({ page, request }) => {
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 against deployed shop-admin");
    const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3030").replace(
      /\/+$/,
      "",
    );
    const credentials = requireStaffAcceptanceCredentials();
    const session = await openStaffBrowserSession({
      page,
      baseUrl,
      authBaseUrl,
      email: credentials.email,
      password: credentials.password,
      totpSecret: credentials.totpSecret,
    });

    for (const route of CORE_ROUTES) {
      await assertStaffSurface(page, session.baseUrl, route);
    }

    const ordersRes = await request.get(`${session.baseUrl}/api/admin/orders`, {
      headers: { cookie: session.cookieHeader },
    });
    if (ordersRes.ok()) {
      const ordersJson = (await ordersRes.json()) as { items?: Array<{ orderId?: string }> };
      const orderId = ordersJson.items?.[0]?.orderId;
      if (orderId) {
        await assertStaffSurface(page, session.baseUrl, {
          path: `/orders/${orderId}`,
          heading: /^Order /,
        });
      }
    }

    const clientsRes = await request.get(`${session.baseUrl}/api/admin/clients`, {
      headers: { cookie: session.cookieHeader },
    });
    if (clientsRes.ok()) {
      const clientsJson = (await clientsRes.json()) as { items?: Array<{ partyId?: string }> };
      const partyId = clientsJson.items?.[0]?.partyId;
      if (partyId) {
        await page.goto(`${session.baseUrl}/clients/${partyId}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole("heading", { name: "Could not load" })).toHaveCount(0);
      }
    }

    const artistsRes = await request.get(`${session.baseUrl}/api/admin/artists`, {
      headers: { cookie: session.cookieHeader },
    });
    if (artistsRes.ok()) {
      const artistsJson = (await artistsRes.json()) as { items?: Array<{ artistId?: string }> };
      const artistId = artistsJson.items?.[0]?.artistId;
      if (artistId) {
        await page.goto(`${session.baseUrl}/artists/${artistId}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole("heading", { name: "Could not load" })).toHaveCount(0);
      }
    }

    for (const route of FLAGGED_ROUTES) {
      if (!route.feature) continue;
      skipStaffFeatureUnlessEnabled(route.feature);
      await requireFeatureOrSkip(request, session, route.feature);
      await assertStaffSurface(page, session.baseUrl, route);
    }
  });
});
