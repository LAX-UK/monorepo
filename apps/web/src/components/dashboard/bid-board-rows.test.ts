import { buildBidBoardRows } from "@/components/dashboard/bid-board-rows";
import type { Bid, Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

function activeLot(id: string): Lot {
  return {
    id,
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
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "500.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "50.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-01-01T00:00:00.000Z"),
    endTime: new Date("2026-01-02T00:00:00.000Z"),
    status: "active",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
  };
}

describe("buildBidBoardRows placement", () => {
  it("flags saleroom staff paddle bids as on-behalf", () => {
    const bid: Bid = {
      id: "bid-1",
      lotId: "lot-1",
      placedByUserId: "buyer-1",
      amount: "1700.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
      placedVia: "saleroom",
      clerkUserId: "clerk-1",
      createdAt: new Date(),
    };
    const { active } = buildBidBoardRows([{ bid, lot: activeLot("lot-1") }], "buyer-1", Date.now());
    expect(active[0]?.placement).toEqual({ onBehalf: true, channelLabel: "Floor" });
  });

  it("does not flag self-service web bids as on-behalf", () => {
    const bid: Bid = {
      id: "bid-2",
      lotId: "lot-1",
      placedByUserId: "buyer-1",
      amount: "600.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
      placedVia: "web",
      clerkUserId: null,
      createdAt: new Date(),
    };
    const { active } = buildBidBoardRows([{ bid, lot: activeLot("lot-1") }], "buyer-1", Date.now());
    expect(active[0]?.placement).toEqual({ onBehalf: false, channelLabel: "Online" });
  });
});
