import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";

describe("admin read routes", () => {
  it("returns overview KPIs for finance staff", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "finance-subject",
      payload: {
        scope: "shop.admin",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000),
      },
    } as never);
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps({
        env: {
          ...createMinimalShopApiTestDeps().env,
          SHOP_ADMIN_ENABLED: true,
          SHOP_PAYOUTS_ENABLED: true,
        },
        staffReader: {
          findActiveByIdentitySubject: async (subject) =>
            subject === "finance-subject"
              ? { role: "finance" as const, identitySubjectId: subject }
              : null,
          brokerCanAccessClientParty: async () => false,
        },
      }),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/overview/kpis",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      fulfilmentOpenCount: 0,
      payoutsDueCount: 0,
    });
    await app.close();
  });
});
