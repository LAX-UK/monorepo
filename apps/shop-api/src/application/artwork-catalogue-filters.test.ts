import { describe, expect, it } from "vitest";
import { normalizeArtworkCatalogueFilters } from "./artwork-catalogue-filters.js";

describe("normalizeArtworkCatalogueFilters", () => {
  it("swaps inverted price bounds", () => {
    expect(
      normalizeArtworkCatalogueFilters({ minPricePence: 50000, maxPricePence: 10000 }),
    ).toMatchObject({
      minPricePence: 10000,
      maxPricePence: 50000,
    });
  });

  it("maps editionEligible to artwork type edition", () => {
    expect(normalizeArtworkCatalogueFilters({ editionEligible: true })).toMatchObject({
      artworkType: "edition",
    });
  });
});
