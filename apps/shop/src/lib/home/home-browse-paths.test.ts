import { artworkSummary } from "@/test/artwork-summary.fixture";
import type { PublicArtworkFacetCounts } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  type PriceBandCount,
  buildHomeCollections,
  buildHomeQuickFilters,
  chooseCollectionCategories,
  choosePriceBand,
} from "./home-browse-paths";

const band = (maxPounds: number, count: number): PriceBandCount => ({
  maxPounds,
  count,
  covers: [artworkSummary({ slug: `a-${maxPounds}` }), artworkSummary({ slug: `b-${maxPounds}` })],
});

const facets = (
  categories: PublicArtworkFacetCounts["categories"],
  availability = { available: 20, soldOut: 4 },
): PublicArtworkFacetCounts => ({ availability, categories, artists: [] });

describe("price band", () => {
  it("takes the lowest band with enough editions that is not the whole catalogue", () => {
    expect(choosePriceBand([band(300, 9), band(150, 2), band(500, 20)], 20)?.maxPounds).toBe(300);
  });

  it("offers no band when every band is too small or holds everything", () => {
    expect(choosePriceBand([band(150, 2), band(300, 20)], 20)).toBeNull();
    expect(choosePriceBand([], 20)).toBeNull();
  });
});

describe("collections", () => {
  const categories = [
    { slug: "prints", label: "Prints", count: 3 },
    { slug: "portraits", label: "Portraits", count: 9 },
    { slug: "small", label: "Small", count: 2 },
  ];

  it("picks categories with at least three editions, largest first", () => {
    expect(chooseCollectionCategories(facets(categories), 3).map((c) => c.slug)).toEqual([
      "portraits",
      "prints",
    ]);
    expect(chooseCollectionCategories(null, 3)).toEqual([]);
  });

  it("puts the price band first, links each tile to a filtered catalogue and counts it", () => {
    const tiles = buildHomeCollections({
      priceBand: band(150, 5),
      categories: chooseCollectionCategories(facets(categories), 2),
      categoryCovers: { portraits: [artworkSummary({ slug: "p" })] },
    });
    expect(tiles.map((tile) => [tile.title, tile.countLabel, tile.href])).toEqual([
      ["Editions up to £150", "5 editions", "/artworks?availability=available&maxPrice=150"],
      ["Portraits", "9 editions", "/artworks?categorySlug=portraits"],
      ["Prints", "3 editions", "/artworks?categorySlug=prints"],
    ]);
    expect(tiles[1]?.covers.map((cover) => cover.slug)).toEqual(["p"]);
    expect(tiles[2]?.covers).toEqual([]);
  });

  it("shows no tiles at all rather than a lone one", () => {
    expect(
      buildHomeCollections({
        priceBand: null,
        categories: [{ slug: "portraits", label: "Portraits", count: 9 }],
        categoryCovers: {},
      }),
    ).toEqual([]);
  });
});

describe("quick filters", () => {
  it("offers on sale now, the price band and categories, each with its count", () => {
    const filters = buildHomeQuickFilters({
      facets: facets([{ slug: "portraits", label: "Portraits", count: 9 }]),
      priceBand: band(150, 5),
    });
    expect(filters.map((filter) => [filter.label, filter.count, filter.href])).toEqual([
      ["Available now", 20, "/artworks?availability=available"],
      ["Up to £150", 5, "/artworks?availability=available&maxPrice=150"],
      ["Portraits", 9, "/artworks?categorySlug=portraits"],
    ]);
  });

  it("leaves out on sale now when nothing is sold out, since it is the whole catalogue", () => {
    const filters = buildHomeQuickFilters({
      facets: facets(
        [
          { slug: "portraits", label: "Portraits", count: 9 },
          { slug: "prints", label: "Prints", count: 4 },
        ],
        { available: 13, soldOut: 0 },
      ),
      priceBand: null,
    });
    expect(filters.map((filter) => filter.label)).toEqual(["Portraits", "Prints"]);
  });

  it("shows six at most, and none when there would be only one", () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      slug: `c${index}`,
      label: `C${index}`,
      count: 4,
    }));
    expect(buildHomeQuickFilters({ facets: facets(many), priceBand: null })).toHaveLength(6);
    expect(
      buildHomeQuickFilters({
        facets: facets([{ slug: "portraits", label: "Portraits", count: 9 }], {
          available: 9,
          soldOut: 0,
        }),
        priceBand: null,
      }),
    ).toEqual([]);
  });
});
