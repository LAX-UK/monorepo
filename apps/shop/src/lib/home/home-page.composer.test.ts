import { artworkSummary } from "@/test/artwork-summary.fixture";
import type { PublicArtworkFacetCounts } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import type { HomeCatalogueReader, HomeEditionQuery } from "./home-catalogue.port";
import { composeHomePageData } from "./home-page.composer";

const artist = (slug: string) => ({
  slug,
  name: slug,
  discipline: null,
  portraitUrl: null,
  artworkCount: 2,
});

const facets: PublicArtworkFacetCounts = {
  availability: { available: 8, soldOut: 2 },
  categories: [
    { slug: "portraits", label: "Portraits", count: 4 },
    { slug: "landscapes", label: "Landscapes", count: 1 },
  ],
  artists: [],
};

function fakeReader(overrides: Partial<HomeCatalogueReader> = {}): HomeCatalogueReader {
  return {
    listEditions: vi.fn(async (query: HomeEditionQuery) => {
      if (query.placement) return { items: [artworkSummary({ slug: "featured" })] };
      if (query.sort === "priceAsc") return { items: [artworkSummary({ printPricePence: 9500 })] };
      if (query.maxPrice !== undefined) return { items: [], totalCount: query.maxPrice / 10000 };
      if (query.categorySlug) return { items: [artworkSummary({ slug: query.categorySlug })] };
      return { items: [artworkSummary({ slug: "newest" })], totalCount: 8 };
    }),
    countFacets: vi.fn(async () => facets),
    listArtists: vi.fn(async (query) =>
      query.placement ? { items: [artist("featured")] } : { items: [artist("a"), artist("b")] },
    ),
    ...overrides,
  };
}

describe("composeHomePageData", () => {
  it("reads the release, the newest editions, the lowest price, counts and artists", async () => {
    const reader = fakeReader();
    const data = await composeHomePageData(reader);

    expect(reader.listEditions).toHaveBeenCalledWith({
      limit: 4,
      placement: "featured_prints",
    });
    expect(reader.listEditions).toHaveBeenCalledWith({ limit: 5, availability: "available" });
    expect(data.featured.map((item) => item.slug)).toEqual(["featured"]);
    expect(data.editions.map((item) => item.slug)).toEqual(["newest"]);
    expect(data.availableCount).toBe(8);
    expect(data.lowestPricePence).toBe(9500);
    expect(data.facets).toEqual(facets);
    expect(data.artists.map((a) => a.slug)).toEqual(["featured"]);
    expect(data.artistCount).toBe(2);
    expect(data.story).toBeNull();
  });

  it("counts each gift price band in pence against editions on sale", async () => {
    const reader = fakeReader();
    const data = await composeHomePageData(reader);

    expect(reader.listEditions).toHaveBeenCalledWith({
      limit: 2,
      availability: "available",
      maxPrice: 15000,
    });
    expect(data.priceBands.map((band) => [band.maxPounds, band.count])).toEqual([
      [150, 1.5],
      [300, 3],
      [500, 5],
    ]);
  });

  it("reads covers only for categories big enough to be a collection", async () => {
    const reader = fakeReader();
    const data = await composeHomePageData(reader);

    expect(Object.keys(data.categoryCovers)).toEqual(["portraits"]);
    expect(reader.listEditions).not.toHaveBeenCalledWith(
      expect.objectContaining({ categorySlug: "landscapes" }),
    );
  });

  it("keeps the rest of the page when the editions read fails", async () => {
    const base = fakeReader();
    const reader = fakeReader({
      listEditions: vi.fn(async (query: HomeEditionQuery) => {
        if (
          !query.placement &&
          !query.sort &&
          query.maxPrice === undefined &&
          !query.categorySlug
        ) {
          throw new Error("catalogue offline");
        }
        return base.listEditions(query);
      }),
    });

    const data = await composeHomePageData(reader);

    expect(data.editions).toEqual([]);
    expect(data.sectionErrors).toEqual({ editions: "catalogue offline" });
    expect(data.featured).toHaveLength(1);
    expect(data.artists).toHaveLength(1);
  });

  it("leaves counts out when the facet read fails, without failing the page", async () => {
    const data = await composeHomePageData(
      fakeReader({
        countFacets: vi.fn(async () => {
          throw new Error("facets offline");
        }),
      }),
    );

    expect(data.facets).toBeNull();
    expect(data.categoryCovers).toEqual({});
    expect(data.sectionErrors).toEqual({});
  });

  it("falls back to the newest artists when none are featured", async () => {
    const data = await composeHomePageData(
      fakeReader({
        listArtists: vi.fn(async (query) =>
          query.placement
            ? { items: [] }
            : { items: ["a", "b", "c", "d", "e"].map(artist), nextCursor: "next" },
        ),
      }),
    );

    expect(data.artists.map((a) => a.slug)).toEqual(["a", "b", "c", "d"]);
    expect(data.artistCount).toBeNull();
  });
});
