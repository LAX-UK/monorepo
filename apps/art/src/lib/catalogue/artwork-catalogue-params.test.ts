import { describe, expect, it } from "vitest";
import {
  artworkCatalogueClearHref,
  artworkCatalogueFetchQuery,
  artworkCatalogueFilterHref,
  artworkCatalogueHref,
  artworkCataloguePageTitle,
  buildArtworkCatalogueActiveChips,
  countActiveArtworkCatalogueFilters,
  parseArtworkCatalogueParams,
} from "./artwork-catalogue-params.js";

describe("artwork catalogue params", () => {
  it("ignores the retired type, rarity and editionEligible parameters: lax.art lists originals", () => {
    const state = parseArtworkCatalogueParams({
      type: "edition",
      rarity: "limited_edition",
      editionEligible: "true",
    });
    expect(state).toEqual(parseArtworkCatalogueParams({}));
    expect(artworkCatalogueHref(state)).toBe("/artworks");
    expect(artworkCatalogueFetchQuery(state)).toEqual({});
    expect(countActiveArtworkCatalogueFilters(state)).toBe(0);
  });

  it("clears cursor when building filter hrefs", () => {
    const state = parseArtworkCatalogueParams({
      cursor: "abc",
      back: "def",
      categorySlug: "painting",
    });
    expect(artworkCatalogueFilterHref(state, { sort: "titleAsc" })).not.toContain("cursor=");
  });

  it("converts URL pounds to API pence", () => {
    const state = parseArtworkCatalogueParams({ minPrice: "120", maxPrice: "500" });
    expect(artworkCatalogueFetchQuery(state)).toMatchObject({
      minPrice: 12000,
      maxPrice: 50000,
    });
  });

  it("clears list facets with null or an empty list", () => {
    const state = parseArtworkCatalogueParams({
      artistSlug: "flora-powers",
      objectType: "sculpture",
    });
    const href = artworkCatalogueFilterHref(state, {
      artistSlugs: null,
      objectTypes: [],
    });
    expect(href).toBe("/artworks");
    expect(artworkCatalogueClearHref()).toBe("/artworks");
  });

  it("round-trips a single medium link and ignores unknown values", () => {
    const state = parseArtworkCatalogueParams({ objectType: "sculpture" });
    expect(artworkCatalogueFetchQuery(state)).toMatchObject({ objectTypes: ["sculpture"] });
    expect(artworkCatalogueFilterHref(state)).toBe("/sculptures");
    expect(
      buildArtworkCatalogueActiveChips(state, { categories: [], artists: [] }).map((c) => c.label),
    ).toEqual(["Sculpture"]);

    expect(parseArtworkCatalogueParams({ objectType: "nft" }).objectTypes).toEqual([]);
  });

  it("reads comma lists and repeated params, and writes comma lists", () => {
    const state = parseArtworkCatalogueParams({
      objectType: ["painting,print", "painting", "nft"],
      artistSlug: ["ada", "bo"],
    });
    expect(state.objectTypes).toEqual(["painting", "print"]);
    expect(state.artistSlugs).toEqual(["ada", "bo"]);
    expect(artworkCatalogueHref(state)).toBe(
      "/artworks?artistSlug=ada,bo&objectType=painting,print",
    );
    expect(artworkCatalogueFetchQuery(state)).toMatchObject({
      artistSlugs: ["ada", "bo"],
      objectTypes: ["painting", "print"],
    });
    expect(countActiveArtworkCatalogueFilters(state)).toBe(4);
  });

  it("gives every selected value its own removable chip", () => {
    const state = parseArtworkCatalogueParams({ objectType: "painting,print", artistSlug: "ada" });
    const chips = buildArtworkCatalogueActiveChips(state, {
      categories: [],
      artists: [{ slug: "ada", label: "Ada Lane" }],
    });
    expect(chips.map((chip) => [chip.label, chip.removeHref])).toEqual([
      ["Paintings", "/artworks?artistSlug=ada&objectType=print"],
      ["Prints", "/paintings?artistSlug=ada"],
      ["Ada Lane", "/artworks?objectType=painting,print"],
    ]);
  });

  it("routes a single landing medium to its legacy URL and keeps other selections on /artworks", () => {
    const painting = parseArtworkCatalogueParams({ objectType: "painting" });
    expect(artworkCatalogueHref(painting)).toBe("/paintings");
    expect(artworkCatalogueHref(painting, { cursor: "c2", sort: "priceAsc" })).toBe(
      "/paintings?sort=priceAsc&cursor=c2",
    );
    expect(artworkCatalogueFilterHref(painting, { objectTypes: null })).toBe("/artworks");
    expect(artworkCatalogueHref(parseArtworkCatalogueParams({ objectType: "photography" }))).toBe(
      "/artworks?objectType=photography",
    );
    expect(artworkCataloguePageTitle(painting)).toBe("Paintings");
    expect(
      artworkCataloguePageTitle(parseArtworkCatalogueParams({ objectType: "painting,print" })),
    ).toBe("Artworks");
  });
});
