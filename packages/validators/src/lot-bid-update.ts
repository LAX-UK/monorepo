/**
 * The live price update a lot card shows when a bid lands. No schema library here: the parser is
 * in the first scripts of home, sale, lot and artist pages, so the check of the `bid_placed`
 * message is written out by hand. It accepts and returns exactly what the Zod contract in
 * `lot-realtime-events.ts` does (see `lot-bid-update.test.ts`).
 */

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

type Record_ = Record<string, unknown>;

/** What Zod calls an object: not null, an array, a date, a map, a set or a promise. */
function isPlainObject(value: unknown): value is Record_ {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value) || value instanceof Date) return false;
  if (value instanceof Map || value instanceof Set) return false;
  const thenable = value as { then?: unknown; catch?: unknown };
  return !(typeof thenable.then === "function" && typeof thenable.catch === "function");
}

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const optional =
  <T>(check: (value: unknown) => value is T) =>
  (value: unknown): value is T | undefined =>
    value === undefined || check(value);
const nullable =
  <T>(check: (value: unknown) => value is T) =>
  (value: unknown): value is T | null =>
    value === null || check(value);

const optionalString = optional(isString);
const optionalNumber = optional(isNumber);
const optionalBoolean = optional(isBoolean);
const optionalNullableString = optional(nullable(isString));

/** A public `bid_placed` message, as `lotRealtimeBidPlacedPublicSchema` accepts it. */
function isPublicBidPlaced(value: Record_): boolean {
  const bid = value.bid;
  return (
    value.type === "bid_placed" &&
    isString(value.lotId) &&
    isPlainObject(bid) &&
    isString(bid.id) &&
    isString(bid.amount) &&
    optionalString(bid.bidderId) &&
    optionalString(bid.placedByUserId) &&
    optionalBoolean(bid.isAutoBid) &&
    optionalNullableString(bid.autoBidStepAmount) &&
    optionalNullableString(bid.placedVia) &&
    isString(value.currentPrice) &&
    optionalNumber(value.emittedAt) &&
    optionalString(value.outbidUserId) &&
    optionalString(value.nextBidAmount) &&
    optionalNumber(value.bidCount) &&
    optionalBoolean(value.reserveMet)
  );
}

/**
 * The bid update in a realtime message, or null for anything else: a sealed `bid_placed` (no
 * bidder), another event type, or a payload that does not match the contract.
 */
export function parseBidUpdateFromRealtimeRaw(raw: unknown): ParsedBidUpdateFromRealtime | null {
  if (!isPlainObject(raw) || raw.type !== "bid_placed" || !isString(raw.lotId)) return null;
  // The contract tries the sealed shape first, so a message that also says `sealed: true` is sealed.
  if (raw.sealed === true || !isPublicBidPlaced(raw)) return null;
  const bid = raw.bid as Record_;
  const placedBy = bid.placedByUserId as string | undefined;
  const bidder = bid.bidderId as string | undefined;
  const bidderId = placedBy ?? bidder;
  if (!bidderId) return null;
  const outbidUserId = raw.outbidUserId as string | undefined;
  const emittedAt = raw.emittedAt as number | undefined;
  const autoBidStepAmount = bid.autoBidStepAmount as string | null | undefined;
  const placedVia = bid.placedVia as string | null | undefined;
  const bidCount = raw.bidCount as number | undefined;
  const reserveMet = raw.reserveMet as boolean | undefined;
  return {
    lotId: raw.lotId,
    bidId: bid.id as string,
    bidderId,
    amount: bid.amount as string,
    currentPrice: raw.currentPrice as string,
    placedByUserId: placedBy ?? bidder ?? bidderId,
    ...(outbidUserId ? { outbidUserId } : {}),
    ...(emittedAt != null ? { emittedAt } : {}),
    isAutoBid: bid.isAutoBid === true,
    ...(autoBidStepAmount != null ? { autoBidStepAmount } : {}),
    ...(placedVia != null ? { placedVia } : {}),
    ...(bidCount != null ? { bidCount } : {}),
    ...(reserveMet !== undefined ? { reserveMet } : {}),
  };
}
