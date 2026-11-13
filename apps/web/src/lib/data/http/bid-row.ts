import { toObjectRecord } from "@/lib/data/http/object-guards";
import type { Bid } from "@auction/types";

/*
 * A bid row from the API, read without a schema library: the bid writer and the live bid feed on
 * lot and sale pages use it, so it is in their first scripts. It returns exactly what the Zod
 * `bidSchema` returned (see `bid-row.test.ts`); that schema now wraps this function.
 */

/** `null` / `""` / missing → `null`; otherwise `String(value)` (as `zNullableStringFromEmpty`). */
function nullableStringFromEmpty(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

/** A date, a string or a number as a `Date`; anything else as an invalid date (as `zCoerceDate`). */
function coerceDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date(Number.NaN);
}

export function parseBidRow(raw: unknown): Bid {
  const row = toObjectRecord(raw);
  const placedByUserId =
    row.placedByUserId == null || row.placedByUserId === ""
      ? undefined
      : String(row.placedByUserId);
  // A public row names no bidder; its per-lot reference keeps one bidder apart from another.
  const bidderRef =
    row.bidderRef == null || row.bidderRef === "" ? undefined : String(row.bidderRef);
  const bidderId =
    row.bidderId == null || row.bidderId === ""
      ? (placedByUserId ?? bidderRef)
      : String(row.bidderId);
  const placedVia = nullableStringFromEmpty(row.placedVia);
  const clerkUserId = nullableStringFromEmpty(row.clerkUserId);

  return {
    id: String(row.id),
    lotId: String(row.lotId ?? row.auctionId),
    ...(bidderId ? { bidderId } : {}),
    ...(placedByUserId ? { placedByUserId } : {}),
    amount: String(row.amount),
    isWinning: Boolean(row.isWinning),
    isAutoBid: Boolean(row.isAutoBid),
    maxAutoBidAmount: row.maxAutoBidAmount == null ? null : String(row.maxAutoBidAmount),
    autoBidStepAmount: row.autoBidStepAmount == null ? null : String(row.autoBidStepAmount),
    placedVia,
    clerkUserId,
    createdAt: coerceDate(row.createdAt),
  };
}
