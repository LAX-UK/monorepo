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
      currentPrice: "1500.00",
      placedVia: "saleroom",
      bidCount: 4,
    });
  });
});
