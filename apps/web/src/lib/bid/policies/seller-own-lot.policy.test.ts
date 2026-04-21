import { describe, expect, it } from "vitest";
import { sellerOwnLotPolicy } from "./seller-own-lot.policy";
import type { BidPolicyContext } from "./types";

const baseCtx = (): BidPolicyContext => ({
  user: { id: "seller-1", email: "s@x.y", name: "S", role: "user" },
  lot: {
    id: "lot1",
    saleId: null,
    lotNumber: 1,
    sellerId: "seller-1",
    title: "Work",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "c",
    auctionType: "english",
    startingPrice: "1",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "1",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date(),
    endTime: new Date(),
    status: "active",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
  },
  lotStatus: "active",
  loginNextPath: "/artwork/lot1",
});

describe("sellerOwnLotPolicy", () => {
  it("blocks when user id matches lot.sellerId", () => {
    const d = sellerOwnLotPolicy.evaluate(baseCtx());
    expect(d.kind).toBe("block");
    if (d.kind === "block") expect(d.viewId).toBe("seller-own-lot");
  });

  it("allows when user is a different id", () => {
    const d = sellerOwnLotPolicy.evaluate({
      ...baseCtx(),
      user: { id: "buyer", email: "b@x.y", name: "B", role: "user" },
    });
    expect(d.kind).toBe("allow");
  });

  it("allows when not signed in", () => {
    const d = sellerOwnLotPolicy.evaluate({ ...baseCtx(), user: null });
    expect(d.kind).toBe("allow");
  });
});
