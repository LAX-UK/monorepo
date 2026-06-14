import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { DutchAuctionStrategy } from "./dutch.strategy.js";

const CAT = "c1000001-0000-4000-8000-000000000001";

function mkLot(overrides: Partial<Lot> = {}): Lot {
  const now = new Date();
  return {
    id: "auc-1",
    saleId: null,
    lotNumber: null,
    sellerId: "seller-1",
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: CAT,
    auctionType: "dutch",
    startingPrice: "200.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "150.00",
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

describe("DutchAuctionStrategy", () => {
  const strategy = new DutchAuctionStrategy();

  it("requires bid amount to exactly match current dutch price", () => {
    const a = mkLot({ currentPrice: "150.00" });
    expect(strategy.validateBid(a, { bidderId: "u1", amount: 150 }).isOk()).toBe(true);
    expect(strategy.validateBid(a, { bidderId: "u1", amount: 149.99 }).isErr()).toBe(true);
    expect(strategy.validateBid(a, { bidderId: "u1", amount: 150.01 }).isErr()).toBe(true);
  });

  it("rejects seller bidding on own lot", () => {
    const a = mkLot({ sellerId: "s1", currentPrice: "75.00" });
    const r = strategy.validateBid(a, { bidderId: "s1", amount: 75 });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.message).toContain("Seller cannot bid");
  });

  it("determines winner as first acceptance by createdAt", () => {
    const t1 = new Date("2026-01-01T10:00:00Z");
    const t2 = new Date("2026-01-01T10:05:00Z");
    const winner = strategy.determineWinner(mkLot(), [
      {
        id: "b2",
        lotId: "auc-1",
        bidderId: "u2",
        placedByUserId: "u2",
        buyerLegalEntityId: "le-2",
        amount: "150.00",
        isWinning: false,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: t2,
      },
      {
        id: "b1",
        lotId: "auc-1",
        bidderId: "u1",
        placedByUserId: "u1",
        buyerLegalEntityId: "le-1",
        amount: "150.00",
        isWinning: false,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: t1,
      },
    ]);
    expect(winner?.bidderId).toBe("u1");
  });
});
