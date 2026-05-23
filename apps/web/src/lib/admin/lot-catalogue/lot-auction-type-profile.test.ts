import { describe, expect, it } from "vitest";
import {
  getCatalogueStepFieldKeys,
  getHiddenFieldDefaults,
  getLotCatalogueProfile,
} from "./lot-auction-type-profile";

describe("getLotCatalogueProfile", () => {
  it("hides dutch fields for english", () => {
    const p = getLotCatalogueProfile("english");
    expect(p.fields.dutchDecrementAmount.visible).toBe(false);
    expect(p.fields.minBidIncrement.visible).toBe(true);
    expect(p.fields.buyNowPrice.visible).toBe(false);
  });

  it("requires dutch bidding fields for dutch type", () => {
    const p = getLotCatalogueProfile("dutch");
    expect(p.fields.dutchDecrementAmount.visible).toBe(true);
    expect(p.fields.dutchDecrementAmount.required).toBe(true);
    expect(p.fields.reservePrice.visible).toBe(false);
  });

  it("shows buy now price for buy_it_now", () => {
    const p = getLotCatalogueProfile("buy_it_now");
    expect(p.fields.buyNowPrice.visible).toBe(true);
    expect(p.fields.buyNowPrice.required).toBe(true);
    expect(p.fields.reservePrice.visible).toBe(false);
  });

  it("shows minimum bid label for sealed", () => {
    const p = getLotCatalogueProfile("sealed");
    expect(p.fields.startingPrice.label).toBe("Minimum bid");
    expect(p.fields.minBidIncrement.visible).toBe(false);
  });
});

describe("getCatalogueStepFieldKeys", () => {
  it("excludes hidden fields for english", () => {
    const keys = getCatalogueStepFieldKeys("english");
    expect(keys).toContain("startingPrice");
    expect(keys).not.toContain("dutchDecrementAmount");
    expect(keys).not.toContain("buyNowPrice");
  });

  it("includes dutch fields for dutch type", () => {
    const keys = getCatalogueStepFieldKeys("dutch");
    expect(keys).toContain("dutchDecrementAmount");
    expect(keys).toContain("dutchDecrementIntervalMs");
  });

  it("omits artistId when includeArtist is false", () => {
    const keys = getCatalogueStepFieldKeys("english", { includeArtist: false });
    expect(keys).not.toContain("artistId");
  });
});

describe("getHiddenFieldDefaults", () => {
  it("clears dutch fields when switching to english", () => {
    const defaults = getHiddenFieldDefaults("english");
    expect(defaults.dutchDecrementAmount).toBe("");
    expect(defaults.buyNowPrice).toBe("");
  });
});
