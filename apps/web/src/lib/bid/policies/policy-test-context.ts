import type { Lot } from "@auction/types";
import type { BidPolicyContext } from "./types";

export function policyLot(over: Partial<Lot> = {}): Lot {
  return {
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
    ...over,
  };
}

export function policyContext(over: Partial<BidPolicyContext> = {}): BidPolicyContext {
  return {
    user: { id: "u1", email: "a@b.c", name: "A", role: "client" },
    lot: policyLot(),
    lotStatus: "active",
    loginNextPath: "/lot/test-lot/lot1",
    ...over,
  };
}
