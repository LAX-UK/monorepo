import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";

function adminDeps(overrides: Parameters<typeof createMinimalShopApiTestDeps>[0] = {}) {
  return createMinimalShopApiTestDeps({
    env: {
      ...createMinimalShopApiTestDeps().env,
      SHOP_ADMIN_ENABLED: true,
      SHOP_PAYOUTS_ENABLED: true,
      ...overrides.env,
    },
    staffReader: {
      findActiveByIdentitySubject: async (subject) =>
        subject === "finance-subject"
          ? { role: "finance" as const, identitySubjectId: subject }
          : subject === "ops-subject"
            ? { role: "operations" as const, identitySubjectId: subject }
            : null,
      brokerCanAccessClientParty: async () => false,
      ...overrides.staffReader,
    },
    ...overrides,
  });
}

describe("admin auth and authz", () => {
  it("returns 401 without bearer token on admin routes", async () => {
    const app = createShopApiApp({ deps: adminDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/production/tasks",
      payload: {
        orderLineId: "00000000-0000-4000-8000-000000000001",
        editionId: "00000000-0000-4000-8000-000000000002",
      },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("returns 403 when shop.admin scope is missing", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "ops-subject",
      payload: {
        scope: "shop.read",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000),
      },
    } as never);
    const app = createShopApiApp({ deps: adminDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/production/tasks",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        orderLineId: "00000000-0000-4000-8000-000000000001",
        editionId: "00000000-0000-4000-8000-000000000002",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: SHOP_API_ERROR_CODES.FORBIDDEN });
    await app.close();
  });

  it("returns 403 when acr is not silver", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "ops-subject",
      payload: { scope: "shop.admin", acr: "bronze", auth_time: Math.floor(Date.now() / 1000) },
    } as never);
    const app = createShopApiApp({ deps: adminDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/production/tasks",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        orderLineId: "00000000-0000-4000-8000-000000000001",
        editionId: "00000000-0000-4000-8000-000000000002",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: SHOP_API_ERROR_CODES.STEP_UP_REQUIRED });
    await app.close();
  });

  it("returns 403 for inactive staff", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "unknown-subject",
      payload: {
        scope: "shop.admin",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000),
      },
    } as never);
    const app = createShopApiApp({ deps: adminDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/production/tasks",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        orderLineId: "00000000-0000-4000-8000-000000000001",
        editionId: "00000000-0000-4000-8000-000000000002",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: SHOP_API_ERROR_CODES.STAFF_REQUIRED });
    await app.close();
  });

  it("returns 403 when capability is missing", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "finance-subject",
      payload: {
        scope: "shop.admin",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000),
      },
    } as never);
    const app = createShopApiApp({ deps: adminDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/production/tasks",
      headers: {
        authorization: `Bearer ${ADMIN_TOKEN}`,
        "idempotency-key": "test-key-production-1",
      },
      payload: {
        orderLineId: "00000000-0000-4000-8000-000000000001",
        editionId: "00000000-0000-4000-8000-000000000002",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: SHOP_API_ERROR_CODES.FORBIDDEN });
    await app.close();
  });

  it("returns 403 on finance routes when auth_time is stale", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "finance-subject",
      payload: {
        scope: "shop.admin",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000) - 10_000,
      },
    } as never);
    const app = createShopApiApp({ deps: adminDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/refunds",
      headers: {
        authorization: `Bearer ${ADMIN_TOKEN}`,
        "idempotency-key": "test-key-refund-1",
      },
      payload: {
        orderId: "00000000-0000-4000-8000-000000000003",
        amountPence: 100,
        idempotencyKey: "body-key",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: SHOP_API_ERROR_CODES.STEP_UP_REQUIRED });
    await app.close();
  });

  it("returns staff session with role, capabilities, and feature flags", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "admin-subject",
      payload: {
        scope: "shop.admin",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000),
      },
    } as never);
    const base = createMinimalShopApiTestDeps();
    const app = createShopApiApp({
      deps: adminDeps({
        staffReader: {
          findActiveByIdentitySubject: async (subject) =>
            subject === "admin-subject"
              ? { role: "shop_admin" as const, identitySubjectId: subject }
              : null,
          brokerCanAccessClientParty: async () => false,
        },
        admin: {
          ...base.admin,
          featureFlags: {
            read: () => ({
              payouts: true,
              thirdPartySales: false,
              originalSales: true,
              merchandise: false,
            }),
          },
        },
      }),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/session",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      subject: "admin-subject",
      role: "shop_admin",
      features: {
        payouts: true,
        thirdPartySales: false,
        originalSales: true,
        merchandise: false,
      },
    });
    expect(response.json().capabilities).toContain("production.write");
    await app.close();
  });

  it("returns 400 when Idempotency-Key header is missing", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "admin-subject",
      payload: {
        scope: "shop.admin",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000),
      },
    } as never);
    const app = createShopApiApp({
      deps: adminDeps({
        env: {
          ...createMinimalShopApiTestDeps().env,
          SHOP_ADMIN_ENABLED: true,
          SHOP_THIRD_PARTY_ENABLED: true,
        },
        staffReader: {
          findActiveByIdentitySubject: async (subject) =>
            subject === "admin-subject"
              ? { role: "shop_admin" as const, identitySubjectId: subject }
              : subject === "finance-subject"
                ? { role: "finance" as const, identitySubjectId: subject }
                : subject === "ops-subject"
                  ? { role: "operations" as const, identitySubjectId: subject }
                  : null,
          brokerCanAccessClientParty: async () => false,
        },
      }),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/holds",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        editionId: "00000000-0000-4000-8000-000000000010",
        clientPartyId: "00000000-0000-4000-8000-000000000011",
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: SHOP_API_ERROR_CODES.VALIDATION });
    await app.close();
  });
});
