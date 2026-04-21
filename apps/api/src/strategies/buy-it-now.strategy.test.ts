import type { Bid, Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { BuyItNowAuctionStrategy } from "./buy-it-now.strategy.js";

const CAT = "c1000001-0000-4000-8000-000000000001";

function mkLot(overrides: Partial<Lot> = {}): Lot {
  const now = new Date();
  return {
    id: "lot-1",
    saleId: null,
    lotNumber: null,
    sellerId: "seller-1",
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: CAT,
    auctionType: "buy_it_now",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: "500.00",
    currentPrice: "100.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: new Date(now.getTime() - 60_000),
    endTime: new Date(now.getTime() + 60 * 60_000),
    status: "active",
    winnerId: null,
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
    ...overrides,
  };
}

describe("BuyItNowAuctionStrategy", () => {
  const strategy = new BuyItNowAuctionStrategy();

  it("determineWinner picks highest amount", () => {
    const a = mkLot();
    const t = new Date();
    const bids: Bid[] = [
      {
        id: "b1",
        lotId: a.id,
        bidderId: "u1",
        amount: "150.00",
        isWinning: false,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: t,
      },
      {
        id: "b2",
        lotId: a.id,
        bidderId: "u2",
        amount: "175.00",
        isWinning: true,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: t,
      },
    ];
    expect(strategy.determineWinner(a, bids)?.id).toBe("b2");
  });
});
