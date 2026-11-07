import { artworkSummary } from "@/test/artwork-summary.fixture";
import type { PublicArtworkFacetCounts } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  type PriceBandCount,
  buildHomeBrowseRows,
  buildHomeCollections,
  chooseCollectionCategories,
  choosePriceBand,
  pickCollectionCovers,
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

describe("browse by rows", () => {
  it("offers available now, the two price ranges and the artist with most editions", () => {
    const rows = buildHomeBrowseRows({
      facets: {
        availability: { available: 3, soldOut: 1 },
        categories: [],
        artists: [
          { slug: "juno", name: "Juno Frost", count: 1 },
          { slug: "flora-powers", name: "Flora Powers", count: 4 },
        ],
      },
      priceRanges: [
        { key: "under-100", count: 2 },
        { key: "100-300", count: 1 },
      ],
    });
    expect(rows.map((row) => [row.label, row.count, row.href])).toEqual([
      ["Available now", 3, "/artworks?availability=available"],
      ["Under £100", 2, "/artworks?availability=available&maxPrice=99"],
      ["£100 to £300", 1, "/artworks?availability=available&minPrice=100&maxPrice=300"],
      ["Flora Powers", 4, "/artists/flora-powers"],
    ]);
  });

  it("hides every row that would lead to nothing", () => {
    const rows = buildHomeBrowseRows({
      facets: facets([], { available: 2, soldOut: 0 }),
      priceRanges: [{ key: "under-100", count: 0 }],
    });
    expect(rows.map((row) => row.label)).toEqual(["Available now"]);
    expect(buildHomeBrowseRows({ facets: null, priceRanges: [] })).toEqual([]);
  });
});

describe("collection tile covers", () => {
  const work = (slug: string, imageUrl: string | null, workSlug?: string) =>
    artworkSummary({ slug, imageUrl, ...(workSlug ? { workSlug } : {}) });

  it("picks two works with different pictures", () => {
    const covers = pickCollectionCovers([
      work("a", "/a.jpg"),
      work("b", "/b.jpg"),
      work("c", "/c.jpg"),
    ]);
    expect(covers.map((c) => c.slug)).toEqual(["a", "b"]);
  });

  it("never shows the same image twice: skips a repeated picture for the next distinct work", () => {
    const covers = pickCollectionCovers([
      work("a", "/a.jpg"),
      work("a2", "/a.jpg"),
      work("b", "/b.jpg"),
    ]);
    expect(covers.map((c) => c.slug)).toEqual(["a", "b"]);
  });

  it("counts versions of one work as one work, even with different pictures", () => {
    const covers = pickCollectionCovers([
      work("a", "/a.jpg", "a"),
      work("a-ap", "/a-ap.jpg", "a"),
      work("b", "/b.jpg"),
    ]);
    expect(covers.map((c) => c.slug)).toEqual(["a", "b"]);
  });

  it("skips works without a picture", () => {
    expect(pickCollectionCovers([work("a", null), work("b", "/b.jpg")]).map((c) => c.slug)).toEqual(
      ["b"],
    );
  });

  it("gives one cover, to be shown alone, when only one distinct work exists", () => {
    expect(pickCollectionCovers([work("a", "/a.jpg"), work("a2", "/a.jpg")])).toHaveLength(1);
    expect(pickCollectionCovers([])).toEqual([]);
  });

  it("feeds the tiles the same way", () => {
    const tiles = buildHomeCollections({
      priceBand: {
        maxPounds: 150,
        count: 4,
        covers: [work("a", "/same.jpg"), work("b", "/same.jpg"), work("c", "/c.jpg")],
      },
      categories: [{ slug: "prints", label: "Prints", count: 5 }],
      categoryCovers: { prints: [work("p", "/p.jpg"), work("p2", "/p.jpg")] },
    });
    expect(tiles.map((t) => t.covers.map((c) => c.slug))).toEqual([["a", "c"], ["p"]]);
  });
});
