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

  it("passes through salesChannel when valid", () => {
    expect(normalizeArtworkCatalogueFilters({ salesChannel: "art" })).toMatchObject({
      salesChannel: "art",
    });
    expect(
      normalizeArtworkCatalogueFilters({ salesChannel: "other" as unknown as "shop" }),
    ).not.toHaveProperty("salesChannel");
  });

  it("keeps valid, de-duplicated multi-value object types, rarities and artists", () => {
    const normalized = normalizeArtworkCatalogueFilters({
      objectTypes: ["painting", "nft", "print", "painting"],
      rarities: ["unique", "rare"],
      artistSlugs: ["ada", " ", "ada", "bo"],
    });
    expect(normalized.objectTypes).toEqual(["painting", "print"]);
    expect(normalized.rarities).toEqual(["unique"]);
    expect(normalized.artistSlugs).toEqual(["ada", "bo"]);
  });

  it("omits multi-value filters with no valid members", () => {
    const normalized = normalizeArtworkCatalogueFilters({ objectTypes: ["nft"], rarities: [] });
    expect(normalized).not.toHaveProperty("objectTypes");
    expect(normalized).not.toHaveProperty("rarities");
    expect(normalized).not.toHaveProperty("artistSlugs");
  });
});
