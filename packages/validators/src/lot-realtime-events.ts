import { z } from "zod";

const moneyString = z.string();

/** Minimal bid row embedded in Redis `bid_placed` payloads (full object may include extra fields). */
export const lotRealtimeBidRecordSchema = z
  .object({
    id: z.string(),
    amount: moneyString,
    bidderId: z.string().optional(),
    placedByUserId: z.string().optional(),
    isAutoBid: z.boolean().optional(),
    autoBidStepAmount: z.string().nullable().optional(),
    placedVia: z.string().nullable().optional(),
  })
  .passthrough();

export type LotRealtimeBidRecord = z.infer<typeof lotRealtimeBidRecordSchema>;

export const lotRealtimeBidPlacedSealedSchema = z.object({
  type: z.literal("bid_placed"),
  lotId: z.string(),
  sealed: z.literal(true),
});

export const lotRealtimeBidPlacedPublicSchema = z.object({
  type: z.literal("bid_placed"),
  lotId: z.string(),
  bid: lotRealtimeBidRecordSchema,
  currentPrice: moneyString,
  emittedAt: z.number().optional(),
  outbidUserId: z.string().optional(),
  bidCount: z.number().optional(),
  reserveMet: z.boolean().optional(),
});

export const lotRealtimeLotExtendedSchema = z.object({
  type: z.literal("lot_extended"),
  lotId: z.string(),
  newEndTime: z.string(),
});

export const lotRealtimeProxyCancelledSchema = z.object({
  type: z.literal("proxy_cancelled"),
  lotId: z.string(),
  bidderUserId: z.string(),
  reason: z.string().optional(),
});

export const lotRealtimeLotEndedSchema = z
  .object({
    type: z.literal("lot_ended"),
    lotId: z.string(),
    winnerId: z.string().nullable().optional(),
    bidId: z.string().nullable().optional(),
    currentPrice: moneyString,
    status: z.string(),
    noSale: z.boolean().optional(),
    outcome: z.enum(["sold", "no_sale"]).optional(),
    noSaleReason: z.enum(["reserve_not_met", "no_bids", "clerk_passed", "voided"]).optional(),
    reserveMet: z.boolean().optional(),
    hadBids: z.boolean().optional(),
    trigger: z.enum(["timed", "clerk_hammer", "clerk_no_sale", "early_close"]).optional(),
  })
  .passthrough();

export const lotRealtimeRedisMessageSchema = z.union([
  lotRealtimeBidPlacedSealedSchema,
  lotRealtimeBidPlacedPublicSchema,
  lotRealtimeLotExtendedSchema,
  lotRealtimeProxyCancelledSchema,
  lotRealtimeLotEndedSchema,
]);

export type LotRealtimeRedisMessage = z.infer<typeof lotRealtimeRedisMessageSchema>;

export function parseLotRealtimeRedisMessage(raw: unknown): LotRealtimeRedisMessage | null {
  const parsed = lotRealtimeRedisMessageSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function encodeBidPlacedSealedRedisMessage(lotId: string): string {
  return JSON.stringify(
    lotRealtimeBidPlacedSealedSchema.parse({ type: "bid_placed", lotId, sealed: true }),
  );
}

export type EncodeBidPlacedPublicInput = {
  lotId: string;
  bid: LotRealtimeBidRecord;
  currentPrice: string;
  emittedAt?: number;
  outbidUserId?: string;
  bidCount?: number;
  reserveMet?: boolean;
};

export function encodeBidPlacedPublicRedisMessage(input: EncodeBidPlacedPublicInput): string {
  const payload = lotRealtimeBidPlacedPublicSchema.parse({
    type: "bid_placed",
    lotId: input.lotId,
    bid: input.bid,
    currentPrice: input.currentPrice,
    emittedAt: input.emittedAt ?? Date.now(),
    ...(input.outbidUserId ? { outbidUserId: input.outbidUserId } : {}),
    ...(input.bidCount != null ? { bidCount: input.bidCount } : {}),
    ...(input.reserveMet !== undefined ? { reserveMet: input.reserveMet } : {}),
  });
  return JSON.stringify(payload);
}

export function encodeLotExtendedRedisMessage(input: {
  lotId: string;
  newEndTime: string;
}): string {
  return JSON.stringify(
    lotRealtimeLotExtendedSchema.parse({
      type: "lot_extended",
      lotId: input.lotId,
      newEndTime: input.newEndTime,
    }),
  );
}

export function encodeProxyCancelledRedisMessage(input: {
  lotId: string;
  bidderUserId: string;
  reason?: string;
}): string {
  return JSON.stringify(
    lotRealtimeProxyCancelledSchema.parse({
      type: "proxy_cancelled",
      lotId: input.lotId,
      bidderUserId: input.bidderUserId,
      ...(input.reason ? { reason: input.reason } : {}),
    }),
  );
}

/** Web-facing projection of a validated public `bid_placed` payload. */
export type ParsedBidUpdateFromRealtime = {
  lotId: string;
  bidId: string;
  bidderId: string;
  amount: string;
  currentPrice: string;
  endTime?: string;
  outbidUserId?: string;
  emittedAt?: number;
  isAutoBid?: boolean;
  placedByUserId?: string;
  autoBidStepAmount?: string;
  placedVia?: string | null;
  bidCount?: number;
  reserveMet?: boolean;
};

export function bidPlacedRedisMessageToBidUpdate(
  message: LotRealtimeRedisMessage,
): ParsedBidUpdateFromRealtime | null {
  if (message.type !== "bid_placed" || "sealed" in message) return null;
  const bid = message.bid;
  const bidderId = bid.placedByUserId ?? bid.bidderId;
  if (!bidderId) return null;
  const placedByUserId = bid.placedByUserId ?? bid.bidderId ?? bidderId;
  return {
    lotId: message.lotId,
    bidId: bid.id,
    bidderId,
    amount: bid.amount,
    currentPrice: message.currentPrice,
    placedByUserId,
    ...(message.outbidUserId ? { outbidUserId: message.outbidUserId } : {}),
    ...(message.emittedAt != null ? { emittedAt: message.emittedAt } : {}),
    isAutoBid: bid.isAutoBid === true,
    ...(bid.autoBidStepAmount != null ? { autoBidStepAmount: bid.autoBidStepAmount } : {}),
    ...(bid.placedVia != null ? { placedVia: bid.placedVia } : {}),
    ...(message.bidCount != null ? { bidCount: message.bidCount } : {}),
    ...(message.reserveMet !== undefined ? { reserveMet: message.reserveMet } : {}),
  };
}

export function parseBidUpdateFromRealtimeRaw(raw: unknown): ParsedBidUpdateFromRealtime | null {
  const message = parseLotRealtimeRedisMessage(raw);
  if (!message) return null;
  return bidPlacedRedisMessageToBidUpdate(message);
}

/** Sealed active lots must never expose bidder-identifying fields on non-admin fan-out. */
export function sealedBidPlacedHasNoBidderIdentity(payload: LotRealtimeRedisMessage): boolean {
  if (payload.type !== "bid_placed" || !("sealed" in payload)) return false;
  return payload.sealed === true && !("bid" in payload);
}
