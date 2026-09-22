import { describe, expect, it } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

function createDeps() {
  return createMinimalShopApiTestDeps({
    catalogue: {
      listPublicArtworks: async () => ({ items: [] }),
      getPublicArtwork: async () => null,
      listPublicCategories: async () => ({
        items: [{ slug: "art", label: "Art", imageUrl: null, artworkCount: 1 }],
      }),
      getPublicCategory: async (slug) =>
        slug === "art" ? { slug: "art", label: "Art", imageUrl: null, artworkCount: 1 } : null,
      listPublicArtists: async () => ({
        items: [
          {
            slug: "artist",
            name: "Artist",
            discipline: null,
            portraitUrl: null,
            artworkCount: 1,
          },
        ],
      }),
      getPublicArtist: async (slug) =>
        slug === "artist"
          ? {
              slug,
              name: "Artist",
              discipline: null,
              bio: null,
              portraitUrl: null,
              artworkCount: 1,
            }
          : null,
    },
  });
}

describe("storefront directory routes", () => {
  it("serves category and artist contracts with public caching", async () => {
    const app = createShopApiApp({ deps: createDeps(), logger: false });
    await app.ready();

    const categories = await app.inject({
      method: "GET",
      url: "/v1/categories?placement=featured_categories",
    });
    const artists = await app.inject({
      method: "GET",
      url: "/v1/artists?placement=featured_artists",
    });
    const artist = await app.inject({ method: "GET", url: "/v1/artists/artist" });
    const category = await app.inject({ method: "GET", url: "/v1/categories/art" });

    expect(categories.statusCode).toBe(200);
    expect(categories.json()).toMatchObject({ items: [{ slug: "art" }] });
    expect(artists.statusCode).toBe(200);
    expect(artist.statusCode).toBe(200);
    expect(category.statusCode).toBe(200);
    expect(category.json()).toMatchObject({ slug: "art", artworkCount: 1 });
    expect(categories.headers["cache-control"]).toMatch(/public/);
    await app.close();
  });

  it("returns not found for an unknown category slug", async () => {
    const app = createShopApiApp({ deps: createDeps(), logger: false });
    await app.ready();

    const category = await app.inject({
      method: "GET",
      url: "/v1/categories/unknown",
    });

    expect(category.statusCode).toBe(404);
    expect(category.json()).toMatchObject({ code: "shop.not_found" });
    await app.close();
  });

  it("rejects slot types owned by another resource", async () => {
    const app = createShopApiApp({ deps: createDeps(), logger: false });
    await app.ready();

    const categories = await app.inject({
      method: "GET",
      url: "/v1/categories?placement=featured_artists",
    });
    const artists = await app.inject({
      method: "GET",
      url: "/v1/artists?placement=featured_prints",
    });

    expect(categories.statusCode).toBe(400);
    expect(artists.statusCode).toBe(400);
    await app.close();
  });
});
