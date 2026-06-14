import { parseBidUpdateEvent } from "@/lib/realtime/parse-bid-update";
import { describe, expect, it } from "vitest";

describe("parseBidUpdateEvent", () => {
  it("parses placedVia and bidCount from bid update payloads", () => {
    const parsed = parseBidUpdateEvent({
      lotId: "lot-1",
      currentPrice: "1500.00",
      bidCount: 4,
      bid: {
        id: "bid-1",
        bidderId: "user-1",
        placedByUserId: "user-1",
        amount: "1500.00",
        placedVia: "saleroom",
      },
    });

    expect(parsed).toMatchObject({
      lotId: "lot-1",
      bidId: "bid-1",
      bidderId: "user-1",
      currentPrice: "1500.00",
      placedVia: "saleroom",
      bidCount: 4,
    });
  });

  it("parses API-shaped bid payloads with placedByUserId only", () => {
    const parsed = parseBidUpdateEvent({
      type: "bid_placed",
      lotId: "lot-1",
      currentPrice: "110.00",
      emittedAt: Date.now(),
      bid: {
        id: "bid-2",
        lotId: "lot-1",
        placedByUserId: "buyer-2",
        amount: "110.00",
        isWinning: true,
        isAutoBid: false,
        maxAutoBidAmount: null,
        placedVia: "web",
      },
    });

    expect(parsed).toMatchObject({
      lotId: "lot-1",
      bidId: "bid-2",
      bidderId: "buyer-2",
      placedByUserId: "buyer-2",
      amount: "110.00",
      currentPrice: "110.00",
      placedVia: "web",
    });
  });
});
