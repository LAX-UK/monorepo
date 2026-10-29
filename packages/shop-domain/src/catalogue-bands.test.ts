import { describe, expect, it } from "vitest";
import {
  CATALOGUE_PRICE_BANDS,
  CATALOGUE_SIZE_BANDS,
  cataloguePriceBandFor,
  cataloguePriceBandRange,
  catalogueSizeBandFor,
  isCataloguePriceBandKey,
  isCatalogueSizeBandKey,
} from "./catalogue-bands.js";

describe("catalogue price bands", () => {
  it("puts every price in exactly one band, with each bound in the band above it", () => {
    expect(cataloguePriceBandFor(4_999)).toBe("under-50");
    expect(cataloguePriceBandFor(5_000)).toBe("50-100");
    expect(cataloguePriceBandFor(9_999)).toBe("50-100");
    expect(cataloguePriceBandFor(10_000)).toBe("100-300");
    expect(cataloguePriceBandFor(30_000)).toBe("300-plus");
    expect(cataloguePriceBandFor(null)).toBeNull();
  });

  it("chains the bands without gaps", () => {
    CATALOGUE_PRICE_BANDS.slice(1).forEach((band, index) => {
      const previous = CATALOGUE_PRICE_BANDS[index]?.pence as { below?: number };
      expect((band.pence as { from?: number }).from).toBe(previous.below);
    });
  });

  it("recognises its keys and gives their ranges", () => {
    expect(isCataloguePriceBandKey("50-100")).toBe(true);
    expect(isCataloguePriceBandKey("under-1000")).toBe(false);
    expect(cataloguePriceBandRange("100-300")).toEqual({ from: 10_000, below: 30_000 });
  });
});

describe("catalogue size bands", () => {
  it("sizes a work by its longest side", () => {
    expect(catalogueSizeBandFor({ heightCm: 42, widthCm: 29.7 })).toBe("small");
    expect(catalogueSizeBandFor({ heightCm: 40, widthCm: 50 })).toBe("medium");
    expect(catalogueSizeBandFor({ heightCm: 70, widthCm: 99.9 })).toBe("medium");
    expect(catalogueSizeBandFor({ heightCm: 70, widthCm: 100 })).toBe("large");
  });

  it("has no size without a positive height and width", () => {
    expect(catalogueSizeBandFor({ heightCm: 50, widthCm: null })).toBeNull();
    expect(catalogueSizeBandFor({ heightCm: 0, widthCm: 40 })).toBeNull();
  });

  it("recognises its keys", () => {
    expect(CATALOGUE_SIZE_BANDS.map((band) => band.key)).toEqual(["small", "medium", "large"]);
    expect(isCatalogueSizeBandKey("large")).toBe(true);
    expect(isCatalogueSizeBandKey("huge")).toBe(false);
  });
});
