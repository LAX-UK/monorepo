import { draftToPartialState } from "@/components/catalogue/artwork-catalogue-filter-body";
import { describe, expect, it } from "vitest";
import {
  artworkCatalogueFetchQuery,
  artworkCatalogueFilterHref,
  parseArtworkCatalogueParams,
} from "./artwork-catalogue-params.js";

describe("artwork catalogue params", () => {
  it("ignores the retired type filter", () => {
    const state = parseArtworkCatalogueParams({ type: "original", editionEligible: "true" });
    expect(state).not.toHaveProperty("type");
    expect(artworkCatalogueFetchQuery(state)).not.toHaveProperty("type");
    expect(artworkCatalogueFilterHref(state)).toBe("/artworks");
  });

  it("drops the retired price-on-request availability", () => {
    expect(parseArtworkCatalogueParams({ saleState: "price_on_application" })).not.toHaveProperty(
      "availability",
    );
  });

  it("reads availability, and maps links from the old sale-state filter onto it", () => {
    expect(parseArtworkCatalogueParams({ availability: "sold_out" }).availability).toBe("sold_out");
    expect(parseArtworkCatalogueParams({ saleState: "for_sale" }).availability).toBe("available");
    expect(parseArtworkCatalogueParams({ saleState: "sold" }).availability).toBe("sold_out");
    const state = parseArtworkCatalogueParams({ saleState: "for_sale" });
    expect(artworkCatalogueFilterHref(state)).toBe("/artworks?availability=available");
    expect(artworkCatalogueFetchQuery(state)).toEqual({ availability: "available" });
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

  it("clears facets when draft fields are emptied", () => {
    const state = parseArtworkCatalogueParams({
      q: "vessel",
      categorySlug: "painting",
      artistSlug: "flora-powers",
      availability: "available",
      minPrice: "100",
      maxPrice: "500",
    });
    const cleared = draftToPartialState({
      q: "",
      availability: "",
      categorySlug: "",
      artistSlug: "",
      minPrice: "",
      maxPrice: "",
    });
    const href = artworkCatalogueFilterHref(state, cleared);
    expect(href).not.toContain("q=");
    expect(href).not.toContain("categorySlug=");
    expect(href).not.toContain("artistSlug=");
    expect(href).not.toContain("availability=");
    expect(href).not.toContain("minPrice=");
    expect(href).not.toContain("maxPrice=");
  });
});
