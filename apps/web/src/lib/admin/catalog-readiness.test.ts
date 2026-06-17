import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildLotPublishReadiness, lotFitsSaleWindowForPublish } from "./catalog-readiness";

function mkSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "sale-1",
    title: "Sale",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "onsite",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    locationName: "Venue",
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: "1 Street",
    locationAddressLine2: null,
    locationCity: "London",
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    startTime: new Date("2030-06-01T10:00:00Z"),
    endTime: new Date("2030-06-07T18:00:00Z"),
    previewStartTime: null,
    status: "scheduled",
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Sale;
}

function mkLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    sellerId: "s1",
    sellerLegalEntityId: "ent-1",
    title: "Lot",
    description: "Text",
    medium: null,
    dimensions: null,
    images: ["img/a.jpg"],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "1",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "1",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date("2020-01-01T00:00:00Z"),
    endTime: new Date("2020-01-02T00:00:00Z"),
    status: "draft",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: null,
    artistReviewRequired: false,
    ...overrides,
  } as Lot;
}

describe("lotFitsSaleWindowForPublish", () => {
  it("returns true for onsite lots with drifted DB times", () => {
    const sale = mkSale({ deliveryMode: "onsite" });
    const lot = mkLot({
      startTime: new Date("2020-01-01T00:00:00Z"),
      endTime: new Date("2020-01-02T00:00:00Z"),
    });
    expect(lotFitsSaleWindowForPublish(lot, sale)).toBe(true);
  });

  it("returns false for online lots outside the sale window", () => {
    const sale = mkSale({ deliveryMode: "online" });
    const lot = mkLot({
      startTime: new Date("2030-05-01T10:00:00Z"),
      endTime: new Date("2030-05-02T18:00:00Z"),
    });
    expect(lotFitsSaleWindowForPublish(lot, sale)).toBe(false);
  });
});

describe("buildLotPublishReadiness", () => {
  it("does not block onsite lots on sale-window when DB times drift", () => {
    const sale = mkSale({ deliveryMode: "onsite" });
    const lot = mkLot();
    const readiness = buildLotPublishReadiness(lot.id, lot, { sale });
    const saleWindow = readiness.items.find((i) => i.id === "sale-window");
    expect(saleWindow?.ok).toBe(true);
  });
});
