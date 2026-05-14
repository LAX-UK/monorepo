import type { Lot, PortfolioRow } from "@auction/types";
import { describe, expect, it } from "vitest";
import { lotTotalMajorUnits, portfolioRowTotalMajorUnits } from "./lot-pricing-helpers";

function baseLot(overrides: Partial<Lot> = {}): Lot {
  const now = new Date();
  return {
    id: "11111111-1111-4111-8111-111111111111",
    saleId: null,
    lotNumber: 1,
    sellerLegalEntityId: "22222222-2222-4222-8222-222222222222",
    title: "Test",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "",
    auctionType: "english",
    startingPrice: "100",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "1000",
    buyerPremiumRate: "0.25",
    minBidIncrement: "50",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: now,
    status: "active",
    winnerId: null,
    marketingDetails: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("lotTotalMajorUnits", () => {
  it("prefers checkoutPricing total when present", () => {
    const lot = baseLot({
      checkoutPricing: {
        hammerMajor: "1000",
        premiumMajor: "250",
        totalMajor: "1250",
        policyId: "flat:default",
        kind: "flat",
      },
    });
    expect(lotTotalMajorUnits(lot)).toBe(1250);
  });

  it("falls back to hammer * (1 + rate) when checkoutPricing is absent", () => {
    const lot = baseLot({ currentPrice: "200", buyerPremiumRate: "0.1" });
    expect(lotTotalMajorUnits(lot)).toBeCloseTo(220);
  });
});

describe("portfolioRowTotalMajorUnits", () => {
  it("delegates to lotTotalMajorUnits", () => {
    const row: PortfolioRow = {
      lot: baseLot({ currentPrice: "100", buyerPremiumRate: "0.2" }),
      payment: null,
    };
    expect(portfolioRowTotalMajorUnits(row)).toBeCloseTo(120);
  });
});
