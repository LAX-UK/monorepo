import { verifyBearerToken } from "@auction/auth/token-verifier";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../app.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const headers = { authorization: "Bearer user-portal-token" };
const REQUEST_ID = "550e8400-e29b-41d4-a716-446655440050";

function asScope(scope: string) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: "portal-subject-1",
    payload: { scope },
  } as never);
}

function sellerApp(
  overrides: {
    portal?: Partial<ReturnType<typeof createMinimalShopApiTestDeps>["portal"]>;
    payoutsEnabled?: boolean;
  } = {},
) {
  const base = createMinimalShopApiTestDeps();
  return createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: {
        ...base.env,
        SHOP_PORTAL_OWNERSHIP_ENABLED: true,
        SHOP_PAYOUTS_ENABLED: overrides.payoutsEnabled ?? true,
      },
      portal: { ...base.portal, ...overrides.portal },
    }),
    logger: false,
  });
}

const sellerReadRoutes = [
  "/v1/me/sale-authority",
  "/v1/me/sale-authority-requests",
  "/v1/me/artist/artworks",
  "/v1/me/artist/sales",
  "/v1/me/payouts",
  "/v1/me/sales",
  "/v1/me/seller-access",
];

describe("seller routes and the selling scopes", () => {
  it("opens the seller read routes to lax.selling.read and shop.read", async () => {
    const app = sellerApp();
    await app.ready();
    for (const scope of ["lax.selling.read", "shop.read"]) {
      asScope(scope);
      for (const url of sellerReadRoutes) {
        const response = await app.inject({ method: "GET", url, headers });
        expect(response.statusCode, `${scope} ${url}`).toBe(200);
      }
    }
    await app.close();
  });

  it("refuses the portfolio and write scopes on seller read routes", async () => {
    const app = sellerApp();
    await app.ready();
    for (const scope of ["lax.portfolio.read", "lax.selling.write", "shop.write"]) {
      asScope(scope);
      for (const url of sellerReadRoutes) {
        const response = await app.inject({ method: "GET", url, headers });
        expect(response.statusCode, `${scope} ${url}`).toBe(403);
      }
    }
    await app.close();
  });

  it("keeps collection, enquiries, editions and documents on shop.read only", async () => {
    const app = sellerApp();
    await app.ready();
    asScope("lax.selling.read");
    for (const url of [
      "/v1/me/collection",
      "/v1/me/enquiries",
      "/v1/me/editions",
      "/v1/me/documents",
    ]) {
      const response = await app.inject({ method: "GET", url, headers });
      expect(response.statusCode, url).toBe(403);
    }
    await app.close();
  });

  it("lets lax.selling.write and shop.write create a request, but not lax.selling.read", async () => {
    const app = sellerApp();
    await app.ready();
    const payload = { artworkId: "550e8400-e29b-41d4-a716-446655440051", requestedCount: 2 };
    for (const scope of ["lax.selling.write", "shop.write"]) {
      asScope(scope);
      const response = await app.inject({
        method: "POST",
        url: "/v1/me/sale-authority-requests",
        headers,
        payload,
      });
      expect(response.statusCode, scope).toBe(200);
    }
    for (const scope of ["lax.selling.read", "shop.read", "lax.portfolio.read"]) {
      asScope(scope);
      const response = await app.inject({
        method: "POST",
        url: "/v1/me/sale-authority-requests",
        headers,
        payload,
      });
      expect(response.statusCode, scope).toBe(403);
    }
    await app.close();
  });

  it("opens the Connect status routes to lax.selling.read and account-session to lax.selling.write", async () => {
    const app = sellerApp();
    await app.ready();
    asScope("lax.selling.read");
    for (const url of ["/v1/me/connect/config", "/v1/me/connect/status"]) {
      const response = await app.inject({ method: "GET", url, headers });
      expect(response.statusCode, url).not.toBe(403);
    }
    const shopWriteOnly = [
      { url: "/v1/me/connect/account", payload: {} },
      {
        url: "/v1/me/connect/onboarding-link",
        payload: {
          returnUrl: "https://example.com/return",
          refreshUrl: "https://example.com/refresh",
        },
      },
    ];
    for (const { url, payload } of shopWriteOnly) {
      asScope("lax.selling.write");
      const response = await app.inject({ method: "POST", url, headers, payload });
      expect(response.statusCode, url).toBe(403);
    }
    asScope("lax.selling.write");
    const session = await app.inject({
      method: "POST",
      url: "/v1/me/connect/account-session",
      headers,
      payload: { surface: "onboarding" },
    });
    expect(session.statusCode).not.toBe(403);
    asScope("lax.selling.read");
    const refused = await app.inject({
      method: "POST",
      url: "/v1/me/connect/account-session",
      headers,
      payload: { surface: "onboarding" },
    });
    expect(refused.statusCode).toBe(403);
    await app.close();
  });
});

describe("POST /v1/me/sale-authority-requests/:requestId/withdraw", () => {
  const url = `/v1/me/sale-authority-requests/${REQUEST_ID}/withdraw`;

  it("cancels the caller's pending request", async () => {
    const withdraw = vi.fn(async (_subject: string, requestId: string) => ({
      requestId,
      status: "cancelled" as const,
    }));
    const base = createMinimalShopApiTestDeps();
    const app = sellerApp({
      portal: {
        portalOwnership: { ...base.portal.portalOwnership, withdrawSaleAuthorityRequest: withdraw },
      },
    });
    await app.ready();
    asScope("lax.selling.write");
    const response = await app.inject({ method: "POST", url, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ requestId: REQUEST_ID, status: "cancelled" });
    expect(withdraw).toHaveBeenCalledWith("portal-subject-1", REQUEST_ID);
    await app.close();
  });

  it("answers 404 for a request that is not the caller's", async () => {
    const base = createMinimalShopApiTestDeps();
    const app = sellerApp({
      portal: {
        portalOwnership: {
          ...base.portal.portalOwnership,
          withdrawSaleAuthorityRequest: async () => {
            throw new ShopApiError("shop.not_found", "Sale authority request not found", 404);
          },
        },
      },
    });
    await app.ready();
    asScope("shop.write");
    const response = await app.inject({ method: "POST", url, headers });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "shop.not_found" });
    await app.close();
  });

  it("answers 409 when the request was already decided", async () => {
    const base = createMinimalShopApiTestDeps();
    const app = sellerApp({
      portal: {
        portalOwnership: {
          ...base.portal.portalOwnership,
          withdrawSaleAuthorityRequest: async () => {
            throw new ShopApiError("shop.conflict", "This request has already been decided", 409);
          },
        },
      },
    });
    await app.ready();
    asScope("lax.selling.write");
    const response = await app.inject({ method: "POST", url, headers });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ message: "This request has already been decided" });
    await app.close();
  });

  it("rejects a malformed id and read-only scopes", async () => {
    const app = sellerApp();
    await app.ready();
    asScope("lax.selling.write");
    const malformed = await app.inject({
      method: "POST",
      url: "/v1/me/sale-authority-requests/not-a-uuid/withdraw",
      headers,
    });
    expect(malformed.statusCode).toBe(400);
    asScope("lax.selling.read");
    const readOnly = await app.inject({ method: "POST", url, headers });
    expect(readOnly.statusCode).toBe(403);
    await app.close();
  });

  it("answers feature_disabled when portal ownership is off", async () => {
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();
    asScope("lax.selling.write");
    const response = await app.inject({ method: "POST", url, headers });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "shop.feature_disabled" });
    const access = await app.inject({ method: "GET", url: "/v1/me/seller-access", headers });
    expect(access.json()).toMatchObject({ code: "shop.feature_disabled" });
    await app.close();
  });
});

describe("GET /v1/me/seller-access", () => {
  it("answers all false for a plain buyer", async () => {
    const base = createMinimalShopApiTestDeps();
    const app = sellerApp({
      portal: {
        portalOwnership: {
          ...base.portal.portalOwnership,
          listSaleAuthority: async () => [
            {
              artworkId: "550e8400-e29b-41d4-a716-446655440060",
              artworkSlug: "bought-work",
              artworkTitle: "Bought Work",
              ownerPartyId: "550e8400-e29b-41d4-a716-446655440061",
              authorisedCount: 0,
              committedCount: 0,
              lastGrantAt: null,
            },
          ],
        },
      },
    });
    await app.ready();
    asScope("lax.selling.read");
    const response = await app.inject({ method: "GET", url: "/v1/me/seller-access", headers });
    expect(response.json()).toEqual({ editions: false, payouts: false, artist: false });
    await app.close();
  });

  it("reports editions, payouts and artist for a seller", async () => {
    const base = createMinimalShopApiTestDeps();
    const app = sellerApp({
      portal: {
        portalOwnership: {
          ...base.portal.portalOwnership,
          listSaleAuthorityRequests: async () => [
            {
              requestId: REQUEST_ID,
              artworkId: "550e8400-e29b-41d4-a716-446655440060",
              artworkSlug: "work",
              artworkTitle: "Work",
              requestedCount: 1,
              note: null,
              status: "pending",
              createdAt: "2026-01-01T00:00:00.000Z",
              declineReason: null,
              handledAt: null,
            },
          ],
        },
        portalArtist: {
          ...base.portal.portalArtist,
          getLinkedArtist: async () => ({
            artistId: "550e8400-e29b-41d4-a716-446655440030",
            slug: "linked-artist",
            displayName: "Linked Artist",
          }),
        },
      },
    });
    await app.ready();
    asScope("shop.read");
    const response = await app.inject({ method: "GET", url: "/v1/me/seller-access", headers });
    expect(response.json()).toEqual({ editions: true, payouts: true, artist: true });
    await app.close();
  });

  it("never reports payouts while payouts are switched off", async () => {
    const base = createMinimalShopApiTestDeps();
    const app = sellerApp({
      payoutsEnabled: false,
      portal: {
        portalOwnership: {
          ...base.portal.portalOwnership,
          listSaleAuthority: async () => [
            {
              artworkId: "550e8400-e29b-41d4-a716-446655440060",
              artworkSlug: "work",
              artworkTitle: "Work",
              ownerPartyId: "550e8400-e29b-41d4-a716-446655440061",
              authorisedCount: 3,
              committedCount: 0,
              lastGrantAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      },
    });
    await app.ready();
    asScope("shop.read");
    const response = await app.inject({ method: "GET", url: "/v1/me/seller-access", headers });
    expect(response.json()).toEqual({ editions: true, payouts: false, artist: false });
    await app.close();
  });
});
