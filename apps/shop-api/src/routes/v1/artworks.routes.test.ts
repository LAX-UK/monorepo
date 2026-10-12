import { describe, expect, it, vi } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createListPublicArtworksHandler } from "../../application/handlers/list-public-artworks.handler.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";
import {
  mockArtworkDetail,
  mockArtworkSummary,
} from "../../test-support/mock-catalogue-read-models.js";

function createCatalogueDeps() {
  return createMinimalShopApiTestDeps({
    catalogue: {
      listPublicArtworks: async () => ({
        items: [mockArtworkSummary()],
      }),
      getPublicArtwork: async (slug) => (slug === "demo" ? mockArtworkDetail() : null),
      listPublicCategories: async () => ({ items: [] }),
      getPublicCategory: async () => null,
      listPublicArtists: async () => ({ items: [] }),
      getPublicArtist: async () => null,
    },
  });
}

describe("artworks routes", () => {
  it("returns public list without owner fields", async () => {
    const app = createShopApiApp({ deps: createCatalogueDeps(), logger: false });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/v1/artworks" });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<Record<string, unknown>> };
    expect(body.items[0]).not.toHaveProperty("ownerPartyId");
    expect(body.items[0]).not.toHaveProperty("allocation");
    expect(response.headers["cache-control"]).toMatch(/public/);
    await app.close();
  });

  it("maps missing artwork to stable not_found contract", async () => {
    const app = createShopApiApp({ deps: createCatalogueDeps(), logger: false });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/v1/artworks/missing" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "shop.not_found" });
    await app.close();
  });

  it("hides artwork detail from a storefront on another sales channel", async () => {
    const app = createShopApiApp({ deps: createCatalogueDeps(), logger: false });
    await app.ready();
    const sameChannel = await app.inject({
      method: "GET",
      url: "/v1/artworks/demo?salesChannel=shop",
    });
    expect(sameChannel.statusCode).toBe(200);
    const otherChannel = await app.inject({
      method: "GET",
      url: "/v1/artworks/demo?salesChannel=art",
    });
    expect(otherChannel.statusCode).toBe(404);
    expect(otherChannel.json()).toMatchObject({ code: "shop.not_found" });
    await app.close();
  });

  it("forwards text search query to the catalogue handler", async () => {
    const deps = createCatalogueDeps();
    const listPublicArtworks = vi.fn(deps.catalogue.listPublicArtworks);
    deps.catalogue.listPublicArtworks = listPublicArtworks;
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/artworks?q=reed",
    });

    expect(response.statusCode).toBe(200);
    expect(listPublicArtworks).toHaveBeenCalledWith({
      limit: 20,
      filter: { q: "reed" },
    });
    await app.close();
  });

  it("forwards validated filters and rejects incompatible placement slots", async () => {
    const deps = createCatalogueDeps();
    const listPublicArtworks = vi.fn(deps.catalogue.listPublicArtworks);
    deps.catalogue.listPublicArtworks = listPublicArtworks;
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/artworks?placement=featured_prints&editionEligible=true",
    });
    const invalid = await app.inject({
      method: "GET",
      url: "/v1/artworks?placement=featured_artists",
    });

    expect(response.statusCode).toBe(200);
    expect(listPublicArtworks).toHaveBeenCalledWith({
      limit: 20,
      filter: { placement: "featured_prints", editionEligible: true },
    });
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });

  it("supports conditional GETs with ETag", async () => {
    const app = createShopApiApp({ deps: createCatalogueDeps(), logger: false });
    await app.ready();
    const first = await app.inject({ method: "GET", url: "/v1/artworks" });
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();

    const second = await app.inject({
      method: "GET",
      url: "/v1/artworks",
      headers: { "if-none-match": etag ?? "" },
    });

    expect(second.statusCode).toBe(304);
    expect(second.body).toBe("");
    expect(second.headers["cache-control"]).toMatch(/stale-while-revalidate/);
    await app.close();
  });

  it("maps malformed opaque cursors to the validation contract", async () => {
    const deps = createCatalogueDeps();
    deps.catalogue.listPublicArtworks = createListPublicArtworksHandler({
      listPublicArtworks: async () => ({ items: [] }),
      getPublicArtworkBySlug: async () => null,
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/artworks?cursor=malformed",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "shop.validation" });
    expect(response.headers["cache-control"]).toBe("no-store");
    await app.close();
  });
});
