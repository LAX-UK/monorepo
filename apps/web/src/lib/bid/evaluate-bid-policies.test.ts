import { describe, expect, it, vi } from "vitest";
import { evaluateBidPolicies } from "./evaluate-bid-policies";
import type { BidPolicy, BidPolicyContext } from "./policies/types";

const ctx = (over: Partial<BidPolicyContext> = {}): BidPolicyContext => ({
  user: { id: "u1", email: "a@b.c", name: "A", role: "client" },
  lot: {
    id: "lot1",
    saleId: null,
    lotNumber: 1,
    sellerId: "seller1",
    title: "T",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cat",
    auctionType: "english",
    startingPrice: "100",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10",
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
  loginNextPath: "/artwork/test-lot/lot1",
  ...over,
});

describe("evaluateBidPolicies", () => {
  it("returns allow when no policy blocks", () => {
    const alwaysAllow: BidPolicy = {
      id: "a",
      evaluate: () => ({ kind: "allow" }),
    };
    expect(evaluateBidPolicies([alwaysAllow], ctx())).toEqual({ kind: "allow" });
  });

  it("returns first block and does not call later policies", () => {
    const secondEvaluate = vi.fn(() => ({ kind: "allow" as const }));
    const policies: BidPolicy[] = [
      {
        id: "first",
        evaluate: () => ({
          kind: "block",
          viewId: "x",
          render: () => null,
        }),
      },
      { id: "second", evaluate: secondEvaluate },
    ];
    const d = evaluateBidPolicies(policies, ctx());
    expect(d.kind).toBe("block");
    if (d.kind === "block") expect(d.viewId).toBe("x");
    expect(secondEvaluate).not.toHaveBeenCalled();
  });
});
