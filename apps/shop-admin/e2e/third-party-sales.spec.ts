import { expect, test } from "@playwright/test";
import { loadStaffOperationsFixtures } from "./support/acceptance-fixtures.js";
import { createAdminApiClient } from "./support/admin-api.js";
import { requireFeatureOrSkip } from "./support/feature-gate.js";
import { requireStaffAcceptanceCredentials } from "./support/staff-credentials.js";
import { openStaffBrowserSession } from "./support/staff-session.js";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const authBaseUrl = process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid";

test.describe("third-party sales @e2e", () => {
  test("records a third-party sale for acceptance parties", async ({ page, request }) => {
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 against deployed shop-admin");
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3030";

    const credentials = requireStaffAcceptanceCredentials();
    const session = await openStaffBrowserSession({
      page,
      baseUrl,
      authBaseUrl,
      email: credentials.email,
      password: credentials.password,
      totpSecret: credentials.totpSecret,
    });
    await requireFeatureOrSkip(request, session, "thirdPartySales");

    const fixtures = loadStaffOperationsFixtures();
    const admin = createAdminApiClient(request, session.baseUrl);

    const saleRes = await admin.post("third-party-sales", session.cookieHeader, session.csrfToken, {
      editionId: fixtures.holdEditionId,
      sellerPartyId: fixtures.consignorPartyId,
      buyerPartyId: fixtures.buyerPartyId,
      grossPence: 50_000,
    });
    expect(saleRes.ok()).toBe(true);
    const sale = (await saleRes.json()) as { id: string; status: string };
    expect(sale.id).toBeTruthy();
  });
});
