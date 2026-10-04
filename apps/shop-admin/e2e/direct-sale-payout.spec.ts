import { expect, test } from "@playwright/test";
import { loadStaffOperationsFixtures } from "./support/acceptance-fixtures.js";
import { createAdminApiClient } from "./support/admin-api.js";
import { featureDisabledReason, readAdminSessionFeatures } from "./support/feature-gate.js";
import { openStaffBrowserSession } from "./support/staff-session.js";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const authBaseUrl = process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid";

test.describe("direct sale payout @e2e", () => {
  test("queues production for seeded paid order line", async ({ page, request }) => {
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 against deployed shop-admin");
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3030";
    const email = process.env.SHOP_OIDC_TEST_EMAIL ?? "";
    const password = process.env.SHOP_OIDC_TEST_PASSWORD ?? "";
    test.skip(!email || !password, "Staff acceptance credentials required");

    try {
      const features = await readAdminSessionFeatures(request, baseUrl, "");
      test.skip(!features.payouts, featureDisabledReason("payouts"));
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

    const taskRes = await admin.post("production/tasks", session.cookieHeader, session.csrfToken, {
      orderLineId: fixtures.paidOrderLineId,
      editionId: fixtures.paidOrderEditionId,
    });
    expect(taskRes.ok()).toBe(true);
    const task = (await taskRes.json()) as { id: string; status: string };
    expect(task.id).toBeTruthy();
    expect(task.status).toBe("queued");
  });
});
