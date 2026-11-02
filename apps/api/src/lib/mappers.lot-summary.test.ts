import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { mapLotToStaffListRow, mapLotToSummary } from "./mappers.js";

const now = new Date("2026-06-01T12:00:00.000Z");

function baseLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    title: "Test lot",
    description: null,
    medium: "Contemporary",
    dimensions: null,
    images: ["img-key"],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "180000.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "180000.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: new Date("2026-06-02T12:00:00.000Z"),
    status: "active",
    winnerId: null,
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
    ...overrides,
  };
}

describe("mapLotToSummary", () => {
  it("includes catalogue card fields needed for marketing estimates", () => {
    const summary = mapLotToSummary(
      baseLot({
        marketingDetails: {
          estimate: { low: "180000.00", high: "220000.00", currency: "GBP" },
          provenance: [{ note: "Private collection" }],
        },
      }),
    );

    expect(summary.startingPrice).toBe("180000.00");
    expect(summary.auctionType).toBe("english");
    expect(summary.medium).toBe("Contemporary");
    expect(summary.startTime).toEqual(now);
    expect(summary.marketingDetails).toEqual({
      estimate: { low: "180000.00", high: "220000.00", currency: "GBP" },
    });
    expect(summary.marketingDetails.provenance).toBeUndefined();
  });

  it("omits marketingDetails when no estimate is set", () => {
    expect(mapLotToSummary(baseLot()).marketingDetails).toEqual({});
  });

  it("includes hasWinner on ended list rows without exposing buyer id", () => {
    expect(mapLotToSummary(baseLot({ status: "ended", winnerId: "buyer-1" })).hasWinner).toBe(true);
    expect(mapLotToSummary(baseLot({ status: "ended", winnerId: null })).hasWinner).toBe(false);
    expect(
      mapLotToSummary(baseLot({ status: "active", winnerId: null })).hasWinner,
    ).toBeUndefined();
  });
});

describe("mapLotToSummary image assets", () => {
  const imageAssets = [
    { src: "https://cdn.example/a.jpg", width: 1200, height: 800, blurDataURL: "data:x" },
  ];

  it("carries the measured size and blur preview so cards can reserve their plate", () => {
    expect(mapLotToSummary(baseLot({ imageAssets })).imageAssets).toEqual(imageAssets);
  });

  it("leaves the field off when nothing is measured", () => {
    expect(mapLotToSummary(baseLot())).not.toHaveProperty("imageAssets");
    expect(mapLotToSummary(baseLot({ imageAssets: [] }))).not.toHaveProperty("imageAssets");
  });
});

describe("mapLotToStaffListRow", () => {
  it("says whether an ended lot sold without naming the buyer", () => {
    const sold = mapLotToStaffListRow(baseLot({ status: "ended", winnerId: "user-9" }));
    expect(sold).toMatchObject({ hasWinner: true });
    expect(sold).not.toHaveProperty("winnerId");

    const unsold = mapLotToStaffListRow(baseLot({ status: "ended", winnerId: null }));
    expect(unsold).toMatchObject({ hasWinner: false });
  });

  it("leaves the outcome out while the lot is still open", () => {
    expect(mapLotToStaffListRow(baseLot({ status: "active" }))).not.toHaveProperty("hasWinner");
  });
});

describe("mapLotToSummary checkout pricing", () => {
  const pricing = {
    hammerMajor: "1000.00",
    premiumMajor: "250.00",
    totalMajor: "1250.00",
    policyId: "flat:0.25",
    kind: "flat" as const,
  };

  it("carries the premium-inclusive price of a sold lot", () => {
    const summary = mapLotToSummary(
      baseLot({ status: "ended", winnerId: "buyer-1", checkoutPricing: pricing }),
    );
    expect(summary.checkoutPricing).toEqual(pricing);
  });

  it("leaves it off an unsold lot and a lot still on sale", () => {
    expect(
      mapLotToSummary(baseLot({ status: "ended", winnerId: null, checkoutPricing: pricing }))
        .checkoutPricing,
    ).toBeUndefined();
    expect(
      mapLotToSummary(baseLot({ status: "active", checkoutPricing: pricing })).checkoutPricing,
    ).toBeUndefined();
  });
});
