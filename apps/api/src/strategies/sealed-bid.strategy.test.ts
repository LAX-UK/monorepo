import type { Bid, Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { SealedBidAuctionStrategy } from "./sealed-bid.strategy.js";

const CAT = "c1000001-0000-4000-8000-000000000001";

function mkLot(overrides: Partial<Lot> = {}): Lot {
  const now = new Date();
  return {
    id: "auc-1",
    saleId: null,
    lotNumber: null,
    sellerId: "seller-1",
    sellerLegalEntityId: "seller-le",
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: CAT,
    auctionType: "sealed",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: new Date(now.getTime() + 86_400_000),
    status: "active",
    winnerId: null,
    voidedReason: null,
    archivedSeller: false,
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
    ...overrides,
  };
}

function mkBid(amount: string, createdAt: Date, bidderId: string): Bid {
  return {
    id: `bid-${bidderId}`,
    lotId: "auc-1",
    bidderId,
    placedByUserId: bidderId,
    buyerLegalEntityId: `${bidderId}-le`,
    amount,
    isWinning: false,
    isAutoBid: false,
    maxAutoBidAmount: null,
    createdAt,
  };
}

describe("SealedBidAuctionStrategy", () => {
  const strategy = new SealedBidAuctionStrategy();

  it("accepts bid at starting price while lot is active", () => {
    const lot = mkLot();
    expect(strategy.validateBid(lot, { bidderId: "u1", amount: 100 }).isOk()).toBe(true);
    expect(strategy.validateBid(lot, { bidderId: "u1", amount: 99 }).isErr()).toBe(true);
  });

  it("does not extend time on sealed bids", () => {
    expect(strategy.shouldExtendTime(mkLot(), { bidderId: "u1", amount: 100 }, {} as never)).toBe(
      false,
    );
  });

  it("determines winner as highest amount with earliest createdAt tie-break", () => {
    const t1 = new Date("2026-01-01T10:00:00Z");
    const t2 = new Date("2026-01-01T10:05:00Z");
    const winner = strategy.determineWinner(mkLot(), [
      mkBid("150.00", t2, "u2"),
      mkBid("200.00", t1, "u1"),
      mkBid("200.00", t2, "u3"),
    ]);
    expect(winner?.bidderId).toBe("u1");
  });
});
