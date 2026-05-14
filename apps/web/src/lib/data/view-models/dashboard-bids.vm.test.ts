import type { BidWithLot } from "@/lib/data/http/dashboard.server";
import { describe, expect, it } from "vitest";
import { buildDashboardBidsBoardVm } from "./dashboard-bids.vm";

function activeLotBidPair(opts: {
  bidAmount: string;
  currentPrice: string;
  bidCreatedAt: Date;
}): BidWithLot {
  const t = new Date("2026-06-01T12:00:00.000Z");
  const end = new Date("2026-06-02T12:00:00.000Z");
  return {
    bid: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      amount: opts.bidAmount,
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
      placedByUserId: "user-1",
      createdAt: opts.bidCreatedAt,
    },
    lot: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      saleId: null,
      lotNumber: 1,
      sellerLegalEntityId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      title: "Test lot",
      description: null,
      medium: null,
      dimensions: null,
      images: [],
      categoryId: "",
      auctionType: "english",
      startingPrice: "100",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: opts.currentPrice,
      buyerPremiumRate: "0.25",
      minBidIncrement: "50",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: t,
      endTime: end,
      status: "active",
      winnerId: null,
      marketingDetails: {},
      createdAt: t,
      updatedAt: t,
    },
  };
}

describe("buildDashboardBidsBoardVm", () => {
  it("keeps the latest bid per lot for the active tab", () => {
    const now = Date.parse("2026-06-01T12:00:00.000Z");
    const older = new Date("2026-06-01T10:00:00.000Z");
    const newer = new Date("2026-06-01T11:00:00.000Z");
    const rows: BidWithLot[] = [
      activeLotBidPair({ bidAmount: "400", currentPrice: "600", bidCreatedAt: older }),
      activeLotBidPair({ bidAmount: "500", currentPrice: "600", bidCreatedAt: newer }),
    ];
    const out = buildDashboardBidsBoardVm(rows, "user-1", now);
    expect(out.active.length).toBe(1);
    expect(out.active[0]?.bid.amount).toBe("500");
  });
});
