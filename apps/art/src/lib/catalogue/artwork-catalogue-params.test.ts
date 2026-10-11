import { draftToPartialState } from "@/components/catalogue/artwork-catalogue-filter-body";
import { describe, expect, it } from "vitest";
import {
  artworkCatalogueFetchQuery,
  artworkCatalogueFilterHref,
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
      minPrice: "100",
      maxPrice: "500",
    });
    const cleared = draftToPartialState({
      q: "",
      type: "all",
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
  });
});
