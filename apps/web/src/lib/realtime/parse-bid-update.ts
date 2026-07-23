import type { BidUpdateEvent } from "@auction/types";
import { parseBidUpdateFromRealtimeRaw } from "@auction/validators";

/** Decode API/WS `bidUpdate` payloads using the shared lot realtime contract. */
export function parseBidUpdateEvent(raw: unknown): BidUpdateEvent | null {
  const parsed = parseBidUpdateFromRealtimeRaw(raw);
  if (!parsed) return null;
  return {
    lotId: parsed.lotId,
    bidId: parsed.bidId,
    bidderId: parsed.bidderId,
    amount: parsed.amount,
    currentPrice: parsed.currentPrice,
    ...(parsed.endTime !== undefined ? { endTime: parsed.endTime } : {}),
    ...(parsed.outbidUserId !== undefined ? { outbidUserId: parsed.outbidUserId } : {}),
    ...(parsed.emittedAt !== undefined ? { emittedAt: parsed.emittedAt } : {}),
    ...(parsed.isAutoBid !== undefined ? { isAutoBid: parsed.isAutoBid } : {}),
    ...(parsed.placedByUserId !== undefined ? { placedByUserId: parsed.placedByUserId } : {}),
    ...(parsed.autoBidStepAmount !== undefined
      ? { autoBidStepAmount: parsed.autoBidStepAmount }
      : {}),
    ...(parsed.placedVia !== undefined ? { placedVia: parsed.placedVia } : {}),
    ...(parsed.bidCount !== undefined ? { bidCount: parsed.bidCount } : {}),
    ...(parsed.reserveMet !== undefined ? { reserveMet: parsed.reserveMet } : {}),
  };
}
