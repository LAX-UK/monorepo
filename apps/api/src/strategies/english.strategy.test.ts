import type { Bid, Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { DEFAULT_BID_POLICY } from "../services/bid/bid-policy.js";
import { EnglishAuctionStrategy } from "./english.strategy.js";

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
    marketingDetails: {},
    ...overrides,
  };
}

describe("EnglishAuctionStrategy", () => {
  const strategy = new EnglishAuctionStrategy();

  it("rejects bids below current plus minimum increment", () => {
    const a = mkLot({ currentPrice: "100.00", minBidIncrement: "1.00" });
    expect(strategy.validateBid(a, { bidderId: "u1", amount: 100 }).isErr()).toBe(true);
    expect(strategy.validateBid(a, { bidderId: "u1", amount: 100.99 }).isErr()).toBe(true);
  });

  it("accepts bid at least current plus increment", () => {
    const a = mkLot({ currentPrice: "100.00", minBidIncrement: "1.00" });
    const r = strategy.validateBid(a, { bidderId: "u1", amount: 101 });
    expect(r.isOk()).toBe(true);
  });

  it("rejects seller bidding on own lot", () => {
    const a = mkLot({ sellerId: "seller-1", currentPrice: "50.00" });
    const r = strategy.validateBid(a, { bidderId: "seller-1", amount: 100 });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.message).toContain("Seller cannot bid");
  });

  it("getNextPrice is max of current price and bid amount", () => {
    const a = mkLot({ currentPrice: "100.00" });
    expect(strategy.getNextPrice(a, 120)).toBe(120);
    expect(strategy.getNextPrice(a, 80)).toBe(100);
  });

  it("determineWinner picks highest amount", () => {
    const a = mkLot();
    const t0 = new Date("2020-01-01T00:00:00Z");
    const t1 = new Date("2020-01-01T00:01:00Z");
    const bids: Bid[] = [
      {
        id: "b1",
        lotId: a.id,
        bidderId: "u1",
        amount: "50.00",
        isWinning: false,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: t0,
      },
      {
        id: "b2",
        lotId: a.id,
        bidderId: "u2",
        amount: "200.00",
        isWinning: true,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: t1,
      },
      {
        id: "b3",
        lotId: a.id,
        bidderId: "u3",
        amount: "100.00",
        isWinning: false,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: t1,
      },
    ];
    expect(strategy.determineWinner(a, bids)?.id).toBe("b2");
  });

  it("determineWinner breaks ties by earliest createdAt", () => {
    const a = mkLot();
    const early = new Date("2020-01-01T00:00:00Z");
    const late = new Date("2020-01-01T01:00:00Z");
    const bids: Bid[] = [
      {
        id: "b-late",
        lotId: a.id,
        bidderId: "u2",
        amount: "100.00",
        isWinning: false,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: late,
      },
      {
        id: "b-early",
        lotId: a.id,
        bidderId: "u1",
        amount: "100.00",
        isWinning: false,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: early,
      },
    ];
    expect(strategy.determineWinner(a, bids)?.id).toBe("b-early");
  });

  it("shouldExtendTime when less than policy window remains", () => {
    const now = Date.now();
    const a = mkLot({ endTime: new Date(now + 30_000) });
    expect(strategy.shouldExtendTime(a, { bidderId: "u1", amount: 101 }, DEFAULT_BID_POLICY)).toBe(
      true,
    );
  });

  it("rejects bid when bidder is already leading", () => {
    const a = mkLot({ currentPrice: "150.00" });
    const r = strategy.validateBid(
      a,
      { bidderId: "u1", placedByUserId: "u1", amount: 160 },
      { currentWinnerId: "u1" },
    );
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.code).toBe("already_leading");
  });

  it("allows operator telephone bid when buyer is already leading", () => {
    const a = mkLot({ currentPrice: "150.00" });
    const r = strategy.validateBid(
      a,
      { bidderId: "u1", placedByUserId: "u1", amount: 160 },
      { currentWinnerId: "u1", placedVia: "telephone" },
    );
    expect(r.isOk()).toBe(true);
  });

  it("allows absentee bid when buyer is already leading", () => {
    const a = mkLot({ currentPrice: "150.00" });
    const r = strategy.validateBid(
      a,
      { bidderId: "u1", placedByUserId: "u1", amount: 160 },
      { currentWinnerId: "u1", placedVia: "absentee" },
    );
    expect(r.isOk()).toBe(true);
  });
});
