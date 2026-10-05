import { expect, test } from "@playwright/test";
import { loadStaffOperationsFixtures } from "./support/acceptance-fixtures.js";
import { createAdminApiClient } from "./support/admin-api.js";
import { requireFeatureOrSkip, skipStaffFeatureUnlessEnabled } from "./support/feature-gate.js";
import { requireStaffAcceptanceCredentials } from "./support/staff-credentials.js";
import { openStaffBrowserSession } from "./support/staff-session.js";
import { printAppearsUnavailable, storefrontBaseUrl } from "./support/storefront.js";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const authBaseUrl = process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid";

test.describe("stock holds @e2e", () => {
  test("hold blocks storefront purchase then release restores availability", async ({
    page,
    request,
  }) => {
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 against deployed shop-admin");
    skipStaffFeatureUnlessEnabled("thirdPartySales");
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

    const slug = "harbor-print";
    const availableBefore = !(await printAppearsUnavailable(fetch, slug));
    expect(availableBefore).toBe(true);

    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const holdRes = await admin.post("holds", session.cookieHeader, session.csrfToken, {
      editionId: fixtures.holdEditionId,
      clientPartyId: fixtures.consignorPartyId,
      expiresAt,
      note: "acceptance stock hold",
    });
    expect(holdRes.ok()).toBe(true);
    const hold = (await holdRes.json()) as { id: string };
    expect(hold.id).toBeTruthy();

    await expect
      .poll(async () => printAppearsUnavailable(fetch, slug), { timeout: 30_000 })
      .toBe(true);

    const releaseRes = await admin.post(
      `holds/${hold.id}/release`,
      session.cookieHeader,
      session.csrfToken,
      {},
    );
    expect(releaseRes.ok()).toBe(true);

    await expect
      .poll(async () => !printAppearsUnavailable(fetch, slug), { timeout: 30_000 })
      .toBe(true);

    expect(storefrontBaseUrl()).toMatch(/lax\.bid|localhost/);
  });
});
