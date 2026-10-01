import { describe, expect, it } from "vitest";
import { assertFeaturedOriginalArtwork } from "./featured-originals-placement.js";
import { ShopDomainError } from "./shop-domain-error.js";

describe("assertFeaturedOriginalArtwork", () => {
  it("accepts for-sale originals", () => {
    expect(() =>
      assertFeaturedOriginalArtwork({
        eligibleForEditionAllocation: false,
        saleState: "for_sale",
      }),
    ).not.toThrow();
  });

  it("rejects edition artworks", () => {
    expect(() =>
      assertFeaturedOriginalArtwork({
        eligibleForEditionAllocation: true,
        saleState: "for_sale",
      }),
    ).toThrow(ShopDomainError);
  });

  it("rejects sold originals", () => {
    expect(() =>
      assertFeaturedOriginalArtwork({
        eligibleForEditionAllocation: false,
        saleState: "sold",
      }),
    ).toThrow(ShopDomainError);
  });
});
