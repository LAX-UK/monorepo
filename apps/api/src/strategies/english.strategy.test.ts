import type { Auction } from "@auction/types";
import { describe, expect, it } from "vitest";
import { EnglishAuctionStrategy } from "./english.strategy.js";

function auction(overrides: Partial<Auction> = {}): Auction {
  const now = new Date();
  return {
    id: "auc-1",
    sellerId: "seller-1",
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: null,
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
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
    ...overrides,
  };
}

describe("EnglishAuctionStrategy", () => {
  const strategy = new EnglishAuctionStrategy();

  it("rejects bids below current plus minimum increment", () => {
    const a = auction({ currentPrice: "100.00", minBidIncrement: "1.00" });
    expect(strategy.validateBid(a, { bidderId: "u1", amount: 100 }).isErr()).toBe(true);
    expect(strategy.validateBid(a, { bidderId: "u1", amount: 100.99 }).isErr()).toBe(true);
  });

  it("accepts bid at least current plus increment", () => {
    const a = auction({ currentPrice: "100.00", minBidIncrement: "1.00" });
    const r = strategy.validateBid(a, { bidderId: "u1", amount: 101 });
    expect(r.isOk()).toBe(true);
  });

  it("rejects seller bidding on own auction", () => {
    const a = auction({ sellerId: "seller-1", currentPrice: "50.00" });
    const r = strategy.validateBid(a, { bidderId: "seller-1", amount: 100 });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.message).toContain("Seller cannot bid");
  });

  it("getNextPrice is max of current price and bid amount", () => {
    const a = auction({ currentPrice: "100.00" });
    expect(strategy.getNextPrice(a, 120)).toBe(120);
    expect(strategy.getNextPrice(a, 80)).toBe(100);
  });
});
