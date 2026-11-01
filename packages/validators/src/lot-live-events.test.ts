import { describe, expect, it } from "vitest";
import { lotLiveDeliveries } from "./lot-live-events.js";
import {
  encodeBidPlacedPublicRedisMessage,
  encodeLotExtendedRedisMessage,
  parseLotRealtimeRedisMessage,
} from "./lot-realtime-events.js";

const NOW = new Date("2026-11-03T20:00:00.000Z");

function parse(raw: unknown) {
  const message = parseLotRealtimeRedisMessage(raw);
  if (!message) throw new Error("expected a message");
  return message;
}

describe("lotLiveDeliveries", () => {
  it("announces an extension with the new close and the server clock", () => {
    const message = parse(
      JSON.parse(
        encodeLotExtendedRedisMessage({ lotId: "lot-1", newEndTime: "2026-11-03T21:02:00.000Z" }),
      ),
    );
    expect(lotLiveDeliveries(message, NOW)).toEqual([
      {
        audience: "lot",
        event: "lot.extended",
        payload: {
          lotId: "lot-1",
          extendedUntil: "2026-11-03T21:02:00.000Z",
          serverNow: "2026-11-03T20:00:00.000Z",
        },
      },
    ]);
  });

  it("announces a sold lot with its hammer price and no winner", () => {
    const message = parse({
      type: "lot_ended",
      lotId: "lot-1",
      winnerId: "user-secret",
      bidId: "bid-1",
      currentPrice: "7500.00",
      status: "ended",
      outcome: "sold",
      hadBids: true,
      reserveMet: true,
    });
    const [delivery] = lotLiveDeliveries(message, NOW);
    expect(delivery).toMatchObject({
      audience: "lot",
      event: "lot.closed",
      payload: {
        lotId: "lot-1",
        result: { outcome: "sold", hammerPrice: "7500.00", hadBids: true, reserveMet: true },
      },
    });
    expect(JSON.stringify(delivery)).not.toContain("user-secret");
  });

  it("announces an unsold lot without a price", () => {
    const message = parse({
      type: "lot_ended",
      lotId: "lot-1",
      winnerId: null,
      currentPrice: "3000.00",
      status: "ended",
      outcome: "no_sale",
      noSale: true,
      noSaleReason: "reserve_not_met",
      hadBids: true,
    });
    expect(lotLiveDeliveries(message, NOW)[0]).toMatchObject({
      payload: {
        result: {
          outcome: "no_sale",
          hammerPrice: null,
          hadBids: true,
          noSaleReason: "reserve_not_met",
        },
      },
    });
  });

  it("tells only the displaced bidder they were outbid, with the next bid", () => {
    const message = parse(
      JSON.parse(
        encodeBidPlacedPublicRedisMessage({
          lotId: "lot-1",
          currentPrice: "7250.00",
          nextBidAmount: "7500.00",
          outbidUserId: "user-2",
          bid: { id: "bid-9", amount: "7250.00", placedByUserId: "user-1" },
        }),
      ),
    );
    expect(lotLiveDeliveries(message, NOW)).toEqual([
      {
        audience: "user",
        userId: "user-2",
        event: "viewer.outbid",
        payload: {
          lotId: "lot-1",
          currentPrice: "7250.00",
          nextBidAmount: "7500.00",
          serverNow: "2026-11-03T20:00:00.000Z",
        },
      },
    ]);
  });

  it("has nothing page-level to say about a first bid, a sealed bid or a proxy cancel", () => {
    const first = parse(
      JSON.parse(
        encodeBidPlacedPublicRedisMessage({
          lotId: "lot-1",
          currentPrice: "100.00",
          bid: { id: "b", amount: "100.00", placedByUserId: "u" },
        }),
      ),
    );
    expect(lotLiveDeliveries(first, NOW)).toEqual([]);
    expect(
      lotLiveDeliveries(parse({ type: "bid_placed", lotId: "lot-1", sealed: true }), NOW),
    ).toEqual([]);
    expect(
      lotLiveDeliveries(parse({ type: "proxy_cancelled", lotId: "l", bidderUserId: "u" }), NOW),
    ).toEqual([]);
  });
});
