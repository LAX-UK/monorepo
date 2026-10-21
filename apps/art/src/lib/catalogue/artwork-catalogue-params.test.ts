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
  it("maps legacy editionEligible to type=edition", () => {
    expect(parseArtworkCatalogueParams({ editionEligible: "true" }).type).toBe("edition");
  });

  it("clears cursor when building filter hrefs", () => {
    const state = parseArtworkCatalogueParams({
      cursor: "abc",
      back: "def",
      categorySlug: "painting",
    });
    expect(artworkCatalogueFilterHref(state, { type: "original" })).not.toContain("cursor=");
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
      rarity: "unique",
    });
    const href = artworkCatalogueFilterHref(state, {
      artistSlugs: null,
      objectTypes: [],
      rarities: null,
    });
    expect(href).toBe("/artworks");
    expect(artworkCatalogueClearHref()).toBe("/artworks");
  });

  it("round-trips single medium and rarity links and ignores unknown values", () => {
    const state = parseArtworkCatalogueParams({ objectType: "sculpture", rarity: "unique" });
    expect(artworkCatalogueFetchQuery(state)).toMatchObject({
      objectTypes: ["sculpture"],
      rarities: ["unique"],
    });
    expect(artworkCatalogueFilterHref(state)).toBe("/sculptures?rarity=unique");
    expect(
      buildArtworkCatalogueActiveChips(state, { categories: [], artists: [] }).map((c) => c.label),
    ).toEqual(["Sculpture", "Unique"]);

    const bogus = parseArtworkCatalogueParams({ objectType: "nft", rarity: "rare" });
    expect(bogus.objectTypes).toEqual([]);
    expect(bogus.rarities).toEqual([]);
  });

  it("reads comma lists and repeated params, and writes comma lists", () => {
    const state = parseArtworkCatalogueParams({
      objectType: ["painting,print", "painting", "nft"],
      rarity: "unique,open_edition",
      artistSlug: ["ada", "bo"],
    });
    expect(state.objectTypes).toEqual(["painting", "print"]);
    expect(state.rarities).toEqual(["unique", "open_edition"]);
    expect(state.artistSlugs).toEqual(["ada", "bo"]);
    expect(artworkCatalogueHref(state)).toBe(
      "/artworks?artistSlug=ada,bo&objectType=painting,print&rarity=unique,open_edition",
    );
    expect(artworkCatalogueFetchQuery(state)).toMatchObject({
      artistSlugs: ["ada", "bo"],
      objectTypes: ["painting", "print"],
      rarities: ["unique", "open_edition"],
    });
    expect(countActiveArtworkCatalogueFilters(state)).toBe(6);
  });

  it("gives every selected value its own removable chip", () => {
    const state = parseArtworkCatalogueParams({ objectType: "painting,print", artistSlug: "ada" });
    const chips = buildArtworkCatalogueActiveChips(state, {
      categories: [],
      artists: [{ slug: "ada", label: "Ada Lane" }],
    });
    expect(chips.map((chip) => [chip.label, chip.removeHref])).toEqual([
      ["Paintings", "/prints?artistSlug=ada"],
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
