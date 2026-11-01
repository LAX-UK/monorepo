import type { LotRealtimeRedisMessage } from "./lot-realtime-events.js";

/** Socket.IO event names the lot page listens for. */
export const LOT_LIVE_EVENTS = {
  extended: "lot.extended",
  closed: "lot.closed",
  viewerOutbid: "viewer.outbid",
  heartbeat: "heartbeat",
} as const;

/** The close moved later because of a late bid. */
export type LotExtendedLiveEvent = {
  lotId: string;
  extendedUntil: string;
  /** The server clock when the event was made, so the countdown can correct for a skewed device. */
  serverNow: string;
};

/** How a lot ended, in what the room could see: no winner, no account. */
export type LotClosedResult = {
  outcome: "sold" | "no_sale";
  /** The hammer price when the lot sold; `null` otherwise. */
  hammerPrice: string | null;
  hadBids: boolean;
  reserveMet?: boolean;
  noSaleReason?: string;
};

export type LotClosedLiveEvent = {
  lotId: string;
  result: LotClosedResult;
  serverNow: string;
};

/** Sent only to the bidder who was displaced. */
export type ViewerOutbidLiveEvent = {
  lotId: string;
  currentPrice: string;
  /** The least the bidder can bid now, when the publisher knew it. */
  nextBidAmount: string | null;
  serverNow: string;
};

export type HeartbeatLiveEvent = {
  serverNow: string;
};

/** One event to deliver, and who gets it. */
export type LotLiveDelivery =
  | { audience: "lot"; event: "lot.extended"; payload: LotExtendedLiveEvent }
  | { audience: "lot"; event: "lot.closed"; payload: LotClosedLiveEvent }
  | { audience: "user"; userId: string; event: "viewer.outbid"; payload: ViewerOutbidLiveEvent };

/**
 * The page-level events a published lot message implies, in addition to the price and state
 * events clients already receive. Pure: the gateway only decides rooms and sends.
 */
export function lotLiveDeliveries(message: LotRealtimeRedisMessage, now: Date): LotLiveDelivery[] {
  const serverNow = now.toISOString();
  switch (message.type) {
    case "lot_extended":
      return [
        {
          audience: "lot",
          event: LOT_LIVE_EVENTS.extended,
          payload: { lotId: message.lotId, extendedUntil: message.newEndTime, serverNow },
        },
      ];
    case "lot_ended":
      return [
        {
          audience: "lot",
          event: LOT_LIVE_EVENTS.closed,
          payload: { lotId: message.lotId, result: closedResult(message), serverNow },
        },
      ];
    case "bid_placed": {
      if ("sealed" in message || !message.outbidUserId) return [];
      return [
        {
          audience: "user",
          userId: message.outbidUserId,
          event: LOT_LIVE_EVENTS.viewerOutbid,
          payload: {
            lotId: message.lotId,
            currentPrice: message.currentPrice,
            nextBidAmount: message.nextBidAmount ?? null,
            serverNow,
          },
        },
      ];
    }
    default:
      return [];
  }
}

function closedResult(message: Extract<LotRealtimeRedisMessage, { type: "lot_ended" }>) {
  const sold = message.outcome ? message.outcome === "sold" : !message.noSale;
  return {
    outcome: sold ? "sold" : "no_sale",
    hammerPrice: sold ? message.currentPrice : null,
    hadBids: message.hadBids ?? sold,
    ...(message.reserveMet !== undefined ? { reserveMet: message.reserveMet } : {}),
    ...(!sold && message.noSaleReason ? { noSaleReason: message.noSaleReason } : {}),
  } satisfies LotClosedResult;
}
