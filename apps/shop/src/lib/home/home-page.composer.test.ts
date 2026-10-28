import { artworkSummary } from "@/test/artwork-summary.fixture";
import type {
  PublicArtistDetail,
  PublicArtistSummary,
  PublicArtworkFacetCounts,
} from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import type { HomeArtistQuery, HomeCatalogueReader, HomeEditionQuery } from "./home-catalogue.port";
import { composeHomePageData } from "./home-page.composer";

const artist = (slug: string): PublicArtistSummary => ({
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

const detail = (slug: string): PublicArtistDetail => ({
  ...artist(slug),
  bio: null,
  shortBio: "A short bio.",
  seoTitle: null,
  seoDescription: null,
});

function fakeReader(overrides: Partial<HomeCatalogueReader> = {}): HomeCatalogueReader {
  return {
    listEditions: vi.fn(async (query: HomeEditionQuery) => {
      if (query.placement) return { items: [artworkSummary({ slug: "featured" })] };
      if (query.sort === "priceAsc") return { items: [artworkSummary({ printPricePence: 9500 })] };
      if (query.minPrice !== undefined) return { items: [], totalCount: 1 };
      if (query.maxPrice !== undefined) return { items: [], totalCount: query.maxPrice / 10000 };
      if (query.categorySlug) return { items: [artworkSummary({ slug: query.categorySlug })] };
      return { items: [artworkSummary({ slug: "newest" })], totalCount: 8 };
    }),
    countFacets: vi.fn(async () => facets),
    listArtists: vi.fn(async (query: HomeArtistQuery) =>
      query.placement
        ? { items: [artist("featured")] }
        : { items: [artist("featured"), artist("a"), artist("b")], total: 3 },
    ),
    getArtist: vi.fn(async (slug: string) => detail(slug)),
    ...overrides,
  };
}

describe("composeHomePageData", () => {
  it("reads the release, the newest editions, the lowest price and counts", async () => {
    const reader = fakeReader();
    const data = await composeHomePageData(reader);

    expect(reader.listEditions).toHaveBeenCalledWith({ limit: 4, placement: "featured_prints" });
    expect(reader.listEditions).toHaveBeenCalledWith({ limit: 5, availability: "available" });
    expect(data.featured.map((item) => item.slug)).toEqual(["featured"]);
    expect(data.editions.map((item) => item.slug)).toEqual(["newest"]);
    expect(data.availableCount).toBe(8);
    expect(data.lowestPricePence).toBe(9500);
    expect(data.facets).toEqual(facets);
  });

  it("asks only for artists with an edition on sale: featured first, then by newest edition", async () => {
    const reader = fakeReader();
    const data = await composeHomePageData(reader);

    expect(reader.listArtists).toHaveBeenCalledWith({
      limit: 8,
      placement: "featured_artists",
      hasAvailableEditions: true,
    });
    expect(reader.listArtists).toHaveBeenCalledWith({
      limit: 16,
      hasAvailableEditions: true,
      sort: "latestEdition",
    });
    expect(data.artists.map((a) => a.slug)).toEqual(["featured", "a", "b"]);
    expect(data.artistCount).toBe(3);
    expect(data.soloArtist).toBeNull();
    expect(reader.getArtist).not.toHaveBeenCalled();
  });

  it("reads the profile of a single artist for the feature", async () => {
    const reader = fakeReader({
      listArtists: vi.fn(async () => ({ items: [artist("flora")], total: 1 })),
    });
    const data = await composeHomePageData(reader);

    expect(reader.getArtist).toHaveBeenCalledWith("flora");
    expect(data.soloArtist?.shortBio).toBe("A short bio.");
  });

  it("keeps a single artist when their profile cannot be read", async () => {
    const data = await composeHomePageData(
      fakeReader({
        listArtists: vi.fn(async () => ({ items: [artist("flora")], total: 1 })),
        getArtist: vi.fn(async () => {
          throw new Error("offline");
        }),
      }),
    );
    expect(data.artists).toHaveLength(1);
    expect(data.soloArtist).toBeNull();
  });

  it("counts the first screen's price ranges in pence, and the gift bands", async () => {
    const reader = fakeReader();
    const data = await composeHomePageData(reader);

    expect(reader.listEditions).toHaveBeenCalledWith({
      limit: 1,
      availability: "available",
      maxPrice: 9900,
    });
    expect(reader.listEditions).toHaveBeenCalledWith({
      limit: 1,
      availability: "available",
      minPrice: 10000,
      maxPrice: 30000,
    });
    expect(data.priceRanges).toEqual([
      { key: "under-100", count: 0.99 },
      { key: "100-300", count: 1 },
    ]);
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

  it("keeps the rest of the page when the editions read fails, without claiming none are on sale", async () => {
    const base = fakeReader();
    const reader = fakeReader({
      listEditions: vi.fn(async (query: HomeEditionQuery) => {
        if (query.limit === 5) throw new Error("catalogue offline");
        return base.listEditions(query);
      }),
    });

    const data = await composeHomePageData(reader);

    expect(data.editions).toEqual([]);
    expect(data.availableCount).toBeNull();
    expect(data.sectionErrors).toEqual({ editions: "catalogue offline" });
    expect(data.featured).toHaveLength(1);
    expect(data.artists).toHaveLength(3);
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
});
