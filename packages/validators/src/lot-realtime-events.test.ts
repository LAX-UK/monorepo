import { describe, expect, it } from "vitest";
import {
  bidPlacedRedisMessageToBidUpdate,
  encodeBidPlacedPublicRedisMessage,
  encodeBidPlacedSealedRedisMessage,
  parseBidUpdateFromRealtimeRaw,
  parseLotRealtimeRedisMessage,
  sealedBidPlacedHasNoBidderIdentity,
} from "./lot-realtime-events.js";

describe("lot realtime redis contract", () => {
  it("round-trips public bid_placed through encode and parse", () => {
    const raw = encodeBidPlacedPublicRedisMessage({
      lotId: "lot-1",
      currentPrice: "120.00",
      bid: {
        id: "bid-1",
        amount: "120.00",
        placedByUserId: "user-1",
        isAutoBid: false,
      },
      bidCount: 3,
      reserveMet: true,
    });
    const parsed = parseLotRealtimeRedisMessage(JSON.parse(raw));
    expect(parsed?.type).toBe("bid_placed");
    if (!parsed) throw new Error("expected parsed message");
    expect(sealedBidPlacedHasNoBidderIdentity(parsed)).toBe(false);
    const update = bidPlacedRedisMessageToBidUpdate(parsed);
    expect(update?.bidderId).toBe("user-1");
    expect(update?.currentPrice).toBe("120.00");
    expect(parseBidUpdateFromRealtimeRaw(JSON.parse(raw))?.bidId).toBe("bid-1");
  });

  it("sealed bid_placed omits bidder identity", () => {
    const raw = encodeBidPlacedSealedRedisMessage("lot-sealed");
    const parsed = parseLotRealtimeRedisMessage(JSON.parse(raw));
    expect(parsed).not.toBeNull();
    if (!parsed) throw new Error("expected parsed message");
    expect(sealedBidPlacedHasNoBidderIdentity(parsed)).toBe(true);
    expect(bidPlacedRedisMessageToBidUpdate(parsed)).toBeNull();
  });
});
