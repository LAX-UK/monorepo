import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { toEditorsPickLotCardVM } from "./home-view-models";

function baseLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    saleId: null,
    lotNumber: 1,
    title: "Test lot",
    description: null,
    medium: "Contemporary",
    dimensions: null,
    images: [],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "1000.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "1000.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-06-01T12:00:00.000Z"),
    endTime: new Date("2026-06-02T12:00:00.000Z"),
    status: "scheduled",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  };
}

describe("toEditorsPickLotCardVM", () => {
  it("uses marketing estimate when present", () => {
    const vm = toEditorsPickLotCardVM(
      baseLot({
        marketingDetails: {
          estimate: { low: "50000", high: "75000", currency: "GBP" },
        },
      }),
    );
    expect(vm.estimateValue).toMatch(/£50,000\.00.*£75,000\.00.*GBP/);
  });

  it("falls back to starting bid instead of rendering undefined", () => {
    const vm = toEditorsPickLotCardVM(
      baseLot({
        startingPrice: "2500.00",
        marketingDetails: {},
      }),
    );
    expect(vm.estimateValue).not.toBe("undefined");
    expect(vm.estimateValue).toMatch(/£2,500\.00/);
  });

  it("shows em dash when no estimate or price is available", () => {
    const vm = toEditorsPickLotCardVM(
      baseLot({
        startingPrice: "undefined",
        currentPrice: "undefined",
        marketingDetails: {},
      }),
    );
    expect(vm.estimateValue).toBe("—");
  });
});
