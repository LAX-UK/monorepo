import { draftToPartialState } from "@/components/catalogue/artwork-catalogue-filter-body";
import { describe, expect, it } from "vitest";
import {
  artworkCatalogueFetchQuery,
  artworkCatalogueFilterHref,
  artworkCatalogueHref,
  artworkCataloguePageTitle,
  buildArtworkCatalogueActiveChips,
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

  it("clears facets when draft fields are emptied", () => {
    const state = parseArtworkCatalogueParams({
      q: "vessel",
      categorySlug: "painting",
      artistSlug: "flora-powers",
      saleState: "for_sale",
      objectType: "sculpture",
      rarity: "unique",
      minPrice: "100",
      maxPrice: "500",
    });
    const cleared = draftToPartialState({
      q: "",
      type: "all",
      objectType: "",
      rarity: "",
      saleState: "",
      categorySlug: "",
      artistSlug: "",
      minPrice: "",
      maxPrice: "",
    });
    const href = artworkCatalogueFilterHref(state, cleared);
    expect(href).not.toContain("q=");
    expect(href).not.toContain("categorySlug=");
    expect(href).not.toContain("artistSlug=");
    expect(href).not.toContain("saleState=");
    expect(href).not.toContain("minPrice=");
    expect(href).not.toContain("maxPrice=");
    expect(href).not.toContain("objectType=");
    expect(href).not.toContain("rarity=");
  });

  it("round-trips medium and rarity facets and ignores unknown values", () => {
    const state = parseArtworkCatalogueParams({ objectType: "sculpture", rarity: "unique" });
    expect(artworkCatalogueFetchQuery(state)).toMatchObject({
      objectType: "sculpture",
      rarity: "unique",
    });
    expect(artworkCatalogueFilterHref(state)).toBe("/sculptures?rarity=unique");
    expect(
      buildArtworkCatalogueActiveChips(state, { categories: [], artists: [] }).map((c) => c.label),
    ).toEqual(["Sculpture", "Unique"]);

    const bogus = parseArtworkCatalogueParams({ objectType: "nft", rarity: "rare" });
    expect(bogus.objectType).toBeUndefined();
    expect(bogus.rarity).toBeUndefined();
  });

  it("routes landing media to their legacy URLs and keeps other media on /artworks", () => {
    const painting = parseArtworkCatalogueParams({ objectType: "painting" });
    expect(artworkCatalogueHref(painting)).toBe("/paintings");
    expect(artworkCatalogueHref(painting, { cursor: "c2", sort: "priceAsc" })).toBe(
      "/paintings?sort=priceAsc&cursor=c2",
    );
    expect(artworkCatalogueFilterHref(painting, { objectType: null })).toBe("/artworks");
    expect(artworkCatalogueHref(parseArtworkCatalogueParams({ objectType: "photography" }))).toBe(
      "/artworks?objectType=photography",
    );
    expect(artworkCataloguePageTitle(painting)).toBe("Paintings");
  });
});
