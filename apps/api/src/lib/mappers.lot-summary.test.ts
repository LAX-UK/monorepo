import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { mapLotToSummary } from "./mappers.js";

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
    expect(mapLotToSummary(baseLot({ status: "ended", winnerId: "buyer-1" })).hasWinner).toBe(
      true,
    );
    expect(mapLotToSummary(baseLot({ status: "ended", winnerId: null })).hasWinner).toBe(false);
    expect(mapLotToSummary(baseLot({ status: "active", winnerId: null })).hasWinner).toBeUndefined();
  });
});
