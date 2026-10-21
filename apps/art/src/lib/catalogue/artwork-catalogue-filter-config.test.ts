import { describe, expect, it } from "vitest";
import { artworkPriceBandPatch, artworkPriceBandValue } from "./artwork-catalogue-filter-config";
import {
  artworkCatalogueFilterHref,
  parseArtworkCatalogueParams,
} from "./artwork-catalogue-params";

describe("artwork price bands", () => {
  it("recognises an applied range that matches a preset exactly", () => {
    expect(artworkPriceBandValue(parseArtworkCatalogueParams({ maxPrice: "1000" }))).toBe(
      "under-1000",
    );
    expect(
      artworkPriceBandValue(parseArtworkCatalogueParams({ minPrice: "1000", maxPrice: "5000" })),
    ).toBe("1000-5000");
  });

  it("reports no preset for no range or a custom range", () => {
    expect(artworkPriceBandValue(parseArtworkCatalogueParams({}))).toBe("");
    expect(artworkPriceBandValue(parseArtworkCatalogueParams({ minPrice: "1200" }))).toBe("");
  });

  it("turns a preset into a min/max patch and the empty value into a cleared range", () => {
    const state = parseArtworkCatalogueParams({ minPrice: "1", maxPrice: "2", cursor: "c2" });
    expect(artworkCatalogueFilterHref(state, artworkPriceBandPatch("over-25000"))).toBe(
      "/artworks?minPrice=25000",
    );
    expect(artworkCatalogueFilterHref(state, artworkPriceBandPatch(""))).toBe("/artworks");
  });
});
