import type { Lot } from "@auction/types";
import { STANDARD_BUYER_PREMIUM_BANDS } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  lotBuyerPremiumCopy,
  saleBuyerPremiumCopy,
  termsBuyerPremiumCopy,
} from "./buyer-premium-copy";

const bandedSale = {
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: [...STANDARD_BUYER_PREMIUM_BANDS],
};
const flatSale = { buyerPremiumRate: "0.2", buyerPremiumTiers: null };
const lot = (over: Partial<Lot> = {}) =>
  ({ saleId: "sale-1", buyerPremiumRate: null, ...over }) as Pick<
    Lot,
    "saleId" | "buyerPremiumRate" | "checkoutPricing"
  >;

describe("lotBuyerPremiumCopy (what buyers read on the lot page and quick look)", () => {
  it("states the sale's bands for a lot without its own premium", () => {
    expect(lotBuyerPremiumCopy(lot(), bandedSale)).toEqual({
      terms: "15% up to £500,000, then 10% on the part above",
      sentence: "Buyer's premium: 15% up to £500,000, then 10% on the part above",
      source: "sale_bands",
    });
  });

  it("states the sale's flat rate", () => {
    expect(lotBuyerPremiumCopy(lot(), flatSale)?.sentence).toBe(
      "Buyer's premium: 20% on the hammer",
    );
  });

  it("states a lot's own premium over the sale's", () => {
    expect(lotBuyerPremiumCopy(lot({ buyerPremiumRate: "0.25" }), bandedSale)).toMatchObject({
      sentence: "Buyer's premium: 25% on the hammer",
      source: "lot",
    });
  });

  it("uses the server's resolved premium when the sale is not at hand", () => {
    const priced = lot({
      checkoutPricing: {
        hammerMajor: "0.00",
        premiumMajor: "0.00",
        totalMajor: "0.00",
        policyId: "bands:[0:0.1500,50000000:0.1000]",
        kind: "tiered",
        premium: {
          source: "sale_bands",
          schedule: { kind: "bands", bands: [...STANDARD_BUYER_PREMIUM_BANDS] },
          breakdown: [],
        },
      },
    });
    expect(lotBuyerPremiumCopy(priced)?.terms).toBe(
      "15% up to £500,000, then 10% on the part above",
    );
  });

  it("never guesses a rate for a lot in a sale it cannot see", () => {
    expect(lotBuyerPremiumCopy(lot())).toBeNull();
  });

  it("a lot outside any sale states the standard premium", () => {
    expect(lotBuyerPremiumCopy(lot({ saleId: null }))?.source).toBe("standard");
  });
});

describe("saleBuyerPremiumCopy (the sale page)", () => {
  it("says the standard bands in plain words", () => {
    expect(saleBuyerPremiumCopy(bandedSale).sentence).toBe(
      "Buyer's premium: 15% up to £500,000, then 10% on the part above",
    );
  });
});

describe("termsBuyerPremiumCopy (the lot detail response's terms)", () => {
  it("words banded terms", () => {
    expect(
      termsBuyerPremiumCopy({
        kind: "banded",
        bands: [
          { fromHammer: "0.00", rate: "0.15" },
          { fromHammer: "500000.00", rate: "0.1" },
        ],
        source: "sale_bands",
      }).terms,
    ).toBe("15% up to £500,000, then 10% on the part above");
  });
});
