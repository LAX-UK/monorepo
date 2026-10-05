import { expect, test } from "@playwright/test";
import { loadStaffOperationsFixtures } from "./support/acceptance-fixtures.js";
import { createAdminApiClient } from "./support/admin-api.js";
import { requireFeatureOrSkip } from "./support/feature-gate.js";
import { requireStaffAcceptanceCredentials } from "./support/staff-credentials.js";
import { openStaffBrowserSession } from "./support/staff-session.js";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const authBaseUrl = process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid";

test.describe("direct sale payout @e2e", () => {
  test("production through fulfilment, possession, eligibility, and mark-paid", async ({
    page,
    request,
  }) => {
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
    await requireFeatureOrSkip(request, session, "payouts");

    const fixtures = loadStaffOperationsFixtures();
    const admin = createAdminApiClient(request, session.baseUrl);

    const taskRes = await admin.post("production/tasks", session.cookieHeader, session.csrfToken, {
      orderLineId: fixtures.paidOrderLineId,
      editionId: fixtures.paidOrderEditionId,
    });
    expect(taskRes.ok()).toBe(true);

    for (const status of ["in_production", "awaiting_dispatch", "ready_for_collection"] as const) {
      const res = await admin.patch("fulfilment", session.cookieHeader, session.csrfToken, {
        fulfilmentId: fixtures.paidOrderFulfilmentId,
        status,
      });
      expect(res.ok(), `fulfilment → ${status}`).toBe(true);
    }

    const possessionAt = new Date().toISOString();
    const possessionRes = await admin.post(
      "fulfilment/possession",
      session.cookieHeader,
      session.csrfToken,
      {
        fulfilmentId: fixtures.paidOrderFulfilmentId,
        status: "collected",
        possessionAt,
      },
    );
    expect(possessionRes.ok()).toBe(true);

    await expect
      .poll(
        async () => {
          const res = await admin.post(
            "payouts/mark-paid",
            session.cookieHeader,
            session.csrfToken,
            {
              payoutId: fixtures.paidOrderPayoutId,
              paidReference: `acceptance-${Date.now()}`,
            },
          );
          if (res.ok()) return "paid";
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          return body.message ?? `http-${res.status()}`;
        },
        { timeout: 120_000, intervals: [3_000, 5_000, 10_000] },
      )
      .toBe("paid");
  });
});
