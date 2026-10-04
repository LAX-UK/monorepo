import { expect, test } from "@playwright/test";
import { loadStaffOperationsFixtures } from "./support/acceptance-fixtures.js";
import { createAdminApiClient } from "./support/admin-api.js";
import { featureDisabledReason, readAdminSessionFeatures } from "./support/feature-gate.js";
import { openStaffBrowserSession } from "./support/staff-session.js";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const authBaseUrl = process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid";

test.describe("original sales @e2e", () => {
  test("creates an original sale reservation", async ({ page, request }) => {
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 against deployed shop-admin");
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3030";
    const email = process.env.SHOP_OIDC_TEST_EMAIL ?? "";
    const password = process.env.SHOP_OIDC_TEST_PASSWORD ?? "";
    test.skip(!email || !password, "Staff acceptance credentials required");

    try {
      const features = await readAdminSessionFeatures(request, baseUrl, "");
      test.skip(!features.originalSales, featureDisabledReason("originalSales"));
    } catch {
      test.skip(true, "shop-admin session unavailable");
    }

    const fixtures = loadStaffOperationsFixtures();
    const session = await openStaffBrowserSession({
      page,
      baseUrl,
      authBaseUrl,
      email,
      password,
      totpSecret: process.env.SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET,
    });
    const admin = createAdminApiClient(request, session.baseUrl);

    const reservationRes = await admin.post(
      "original-sales",
      session.cookieHeader,
      session.csrfToken,
      {
        artworkId: fixtures.originalArtworkId,
        buyerPartyId: fixtures.buyerPartyId,
        salePricePence: 125_000,
        reservationExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      },
    );
    expect(reservationRes.ok()).toBe(true);
    const reservation = (await reservationRes.json()) as { id: string; status: string };
    expect(reservation.id).toBeTruthy();
  });
});
