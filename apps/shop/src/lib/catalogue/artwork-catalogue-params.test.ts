import { describe, expect, it } from "vitest";
import {
  CATALOGUE_MAX_SHOWN,
  artworkCatalogueClearHref,
  artworkCatalogueFetchQuery,
  artworkCatalogueFilterHref,
  artworkCatalogueLoadMoreHref,
  countActiveArtworkCatalogueFilters,
  parseArtworkCatalogueParams,
} from "./artwork-catalogue-params.js";

describe("artwork catalogue params", () => {
  it("ignores the retired type filter", () => {
    const state = parseArtworkCatalogueParams({ type: "original", editionEligible: "true" });
    expect(state).not.toHaveProperty("type");
    expect(artworkCatalogueFetchQuery(state)).not.toHaveProperty("type");
    expect(artworkCatalogueFilterHref(state)).toBe("/artworks");
  });

  it("reads availability, and maps links from the old sale-state filter onto it", () => {
    expect(parseArtworkCatalogueParams({ availability: "sold_out" }).availability).toBe("sold_out");
    expect(parseArtworkCatalogueParams({ saleState: "for_sale" }).availability).toBe("available");
    expect(parseArtworkCatalogueParams({ saleState: "price_on_application" })).not.toHaveProperty(
      "availability",
    );
    const state = parseArtworkCatalogueParams({ saleState: "for_sale" });
    expect(artworkCatalogueFilterHref(state)).toBe("/artworks?availability=available");
  });

  it("falls back to newest for a sort it no longer offers", () => {
    expect(parseArtworkCatalogueParams({ sort: "titleAsc" }).sort).toBe("newest");
    expect(parseArtworkCatalogueParams({ sort: "priceDesc" }).sort).toBe("priceDesc");
  });

  it("asks shop-api for a price band in pence, with the band's upper bound left out", () => {
    const state = parseArtworkCatalogueParams({ price: "50-100" });
    expect(artworkCatalogueFetchQuery(state)).toEqual({ minPrice: 5_000, maxPrice: 9_999 });
    expect(artworkCatalogueFetchQuery(parseArtworkCatalogueParams({ price: "300-plus" }))).toEqual({
      minPrice: 30_000,
    });
  });

  it("keeps a free range in whole pounds from older links, unless a band is given", () => {
    const free = parseArtworkCatalogueParams({ minPrice: "500", maxPrice: "120" });
    expect(artworkCatalogueFetchQuery(free)).toEqual({ minPrice: 12_000, maxPrice: 50_000 });
    const both = parseArtworkCatalogueParams({ price: "under-50", maxPrice: "150" });
    expect(both).toMatchObject({ price: "under-50" });
    expect(both).not.toHaveProperty("maxPrice");
  });

  it("lets a band replace a free range and the other way round", () => {
    const free = parseArtworkCatalogueParams({ maxPrice: "150" });
    expect(artworkCatalogueFilterHref(free, { price: "under-50" })).toBe(
      "/artworks?price=under-50",
    );
    const band = parseArtworkCatalogueParams({ price: "under-50" });
    expect(artworkCatalogueFilterHref(band, { maxPrice: 150 })).toBe("/artworks?maxPrice=150");
  });

  it("reads size and technique, and drops an unknown size", () => {
    const state = parseArtworkCatalogueParams({ size: "large", technique: " Screenprint " });
    expect(artworkCatalogueFetchQuery(state)).toEqual({ size: "large", technique: "Screenprint" });
    expect(parseArtworkCatalogueParams({ size: "huge" })).not.toHaveProperty("size");
  });

  it("counts each applied filter once, a free range included", () => {
    const state = parseArtworkCatalogueParams({
      q: "vessel",
      artistSlug: "flora-powers",
      minPrice: "10",
      maxPrice: "50",
      size: "small",
    });
    expect(countActiveArtworkCatalogueFilters(state)).toBe(4);
  });

  it("grows the list a page at a time, and starts again on a filter change", () => {
    const first = parseArtworkCatalogueParams({ artistSlug: "flora-powers" });
    expect(artworkCatalogueLoadMoreHref(first)).toBe("/artworks?artistSlug=flora-powers&shown=48");
    const more = parseArtworkCatalogueParams({ shown: "48", artistSlug: "flora-powers" });
    expect(more.shown).toBe(48);
    expect(artworkCatalogueFilterHref(more, { size: "small" })).not.toContain("shown=");
  });

  it("keeps the length to whole pages within the most a page shows", () => {
    expect(parseArtworkCatalogueParams({ shown: "30" }).shown).toBe(48);
    expect(parseArtworkCatalogueParams({ shown: "24" })).not.toHaveProperty("shown");
    expect(parseArtworkCatalogueParams({ shown: "100000" }).shown).toBe(CATALOGUE_MAX_SHOWN);
  });

  it("clears every filter but keeps the sort", () => {
    const state = parseArtworkCatalogueParams({ sort: "priceAsc", price: "under-50", q: "x" });
    expect(artworkCatalogueClearHref(state)).toBe("/artworks?sort=priceAsc");
  });
});
