import { describe, expect, it } from "vitest";
import { notLivePolicy } from "./not-live.policy";
import type { BidPolicyContext } from "./types";

const base = (): BidPolicyContext => ({
  user: { id: "u1", email: "a@b.c", name: "A", role: "client" },
  lot: {
    id: "l1",
    saleId: null,
    lotNumber: 1,
    sellerId: "s1",
    title: "T",
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
    status: "ended",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
  },
  lotStatus: "ended",
  loginNextPath: "/artwork/l1",
});

describe("notLivePolicy", () => {
  it("blocks when lotStatus is not active", () => {
    const d = notLivePolicy.evaluate(base());
    expect(d.kind).toBe("block");
  });

  it("allows when lotStatus is active", () => {
    const d = notLivePolicy.evaluate({ ...base(), lotStatus: "active" });
    expect(d.kind).toBe("allow");
  });
});
