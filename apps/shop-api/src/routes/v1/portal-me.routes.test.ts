import { verifyBearerToken } from "@auction/auth/token-verifier";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "portal-subject-1",
    payload: { scope: "shop.read" },
  })),
}));

import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const bffHeaders = {
  authorization: "Bearer test-bff-token-minimum-32-characters-long",
};
const USER_TOKEN = "user-portal-token";
const userHeaders = { authorization: `Bearer ${USER_TOKEN}` };

function portalEnabledDeps(overrides: Parameters<typeof createMinimalShopApiTestDeps>[0] = {}) {
  return createMinimalShopApiTestDeps({
    env: {
      ...createMinimalShopApiTestDeps().env,
      SHOP_PORTAL_OWNERSHIP_ENABLED: true,
    },
    ...overrides,
  });
}

describe("portal me routes", () => {
  it("returns feature_disabled when portal ownership is off", async () => {
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/editions",
      headers: bffHeaders,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "shop.feature_disabled" });
    await app.close();
  });

  it("rejects BFF tokens on portal me routes (user subject required)", async () => {
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps({
        env: {
          ...createMinimalShopApiTestDeps().env,
          SHOP_PORTAL_OWNERSHIP_ENABLED: true,
        },
      }),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/editions",
      headers: bffHeaders,
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("returns null artist and empty items when login is not linked to an artist", async () => {
    const app = createShopApiApp({
      deps: portalEnabledDeps({
        portal: {
          ...createMinimalShopApiTestDeps().portal,
          portalArtist: {
            getLinkedArtist: vi.fn(async () => null),
            listArtworks: vi.fn(async () => []),
            listSales: vi.fn(async () => []),
          },
        },
      }),
      logger: false,
    });
    await app.ready();

    const artworks = await app.inject({
      method: "GET",
      url: "/v1/me/artist/artworks",
      headers: userHeaders,
    });
    expect(artworks.statusCode).toBe(200);
    expect(artworks.json()).toEqual({ artist: null, items: [] });

    const sales = await app.inject({
      method: "GET",
      url: "/v1/me/artist/sales",
      headers: userHeaders,
    });
    expect(sales.statusCode).toBe(200);
    expect(sales.json()).toEqual({ artist: null, items: [] });
    await app.close();
  });

  it("returns linked artist metadata on artist artworks when login is linked", async () => {
    const linkedArtist = {
      artistId: "550e8400-e29b-41d4-a716-446655440030",
      slug: "linked-artist",
      displayName: "Linked Artist",
    };
    const artworkItems = [
      {
        artworkId: "550e8400-e29b-41d4-a716-446655440031",
        slug: "linked-work",
        title: "Linked Work",
        saleState: "for_sale",
      },
    ];
    const getLinkedArtist = vi.fn(async () => linkedArtist);
    const listArtworks = vi.fn(async () => artworkItems);
    const listSales = vi.fn(async () => []);

    const app = createShopApiApp({
      deps: portalEnabledDeps({
        portal: {
          ...createMinimalShopApiTestDeps().portal,
          portalArtist: { getLinkedArtist, listArtworks, listSales },
        },
      }),
      logger: false,
    });
    await app.ready();

    const artworks = await app.inject({
      method: "GET",
      url: "/v1/me/artist/artworks",
      headers: userHeaders,
    });
    expect(artworks.statusCode).toBe(200);
    expect(artworks.json()).toEqual({ artist: linkedArtist, items: artworkItems });
    expect(getLinkedArtist).toHaveBeenCalledWith("portal-subject-1");
    expect(listArtworks).toHaveBeenCalledWith("portal-subject-1");
    await app.close();
  });

  it("returns linked artist metadata on artist sales when login is linked", async () => {
    const linkedArtist = {
      artistId: "550e8400-e29b-41d4-a716-446655440030",
      slug: "linked-artist",
      displayName: "Linked Artist",
    };
    const getLinkedArtist = vi.fn(async () => linkedArtist);
    const listArtworks = vi.fn(async () => []);
    const listSales = vi.fn(async () => []);

    const app = createShopApiApp({
      deps: portalEnabledDeps({
        portal: {
          ...createMinimalShopApiTestDeps().portal,
          portalArtist: { getLinkedArtist, listArtworks, listSales },
        },
      }),
      logger: false,
    });
    await app.ready();

    const sales = await app.inject({
      method: "GET",
      url: "/v1/me/artist/sales",
      headers: userHeaders,
    });
    expect(sales.statusCode).toBe(200);
    expect(sales.json()).toEqual({ artist: linkedArtist, items: [] });
    expect(getLinkedArtist).toHaveBeenCalledWith("portal-subject-1");
    expect(listSales).toHaveBeenCalledWith("portal-subject-1");
    await app.close();
  });

  it("returns feature_disabled for artist routes when portal ownership is off", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "portal-subject-1",
      payload: { scope: "shop.read" },
    } as never);
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/me/artist/artworks",
      headers: userHeaders,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "shop.feature_disabled" });
    await app.close();
  });
});
