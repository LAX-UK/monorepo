import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { maskLotForPublicView } from "./lot-public-view.js";

function baseLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    title: "Test lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: "27000.00",
    buyNowPrice: null,
    currentPrice: "1101.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: new Date(),
    endTime: new Date(),
    status: "active",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  };
}

describe("maskLotForPublicView", () => {
  it("strips reservePrice and adds hasReserve/reserveMet for anonymous viewers", () => {
    const result = maskLotForPublicView(baseLot(), undefined);
    expect(result).not.toHaveProperty("reservePrice");
    expect(result).toMatchObject({
      hasReserve: true,
      reserveMet: false,
      currentPrice: "1101.00",
    });
  });

  it("returns reserveMet true when hammer meets reserve", () => {
    const result = maskLotForPublicView(baseLot({ currentPrice: "27000.00" }), undefined);
    expect(result).toMatchObject({ hasReserve: true, reserveMet: true });
  });

  it("returns hasReserve false when no reserve configured", () => {
    const result = maskLotForPublicView(baseLot({ reservePrice: null }), undefined);
    expect(result).toMatchObject({ hasReserve: false, reserveMet: null });
  });

  it("returns full Lot with reservePrice for catalogue staff", () => {
    const result = maskLotForPublicView(baseLot(), "staff", "catalogue_manager");
    expect(result).toHaveProperty("reservePrice", "27000.00");
    expect(result).not.toHaveProperty("hasReserve");
  });

  it("masks sealed current price for anonymous viewers", () => {
    const result = maskLotForPublicView(
      baseLot({ auctionType: "sealed", currentPrice: "500.00", startingPrice: "100.00" }),
      undefined,
    );
    expect(result).toMatchObject({ currentPrice: "100.00", hasReserve: true });
  });
});
