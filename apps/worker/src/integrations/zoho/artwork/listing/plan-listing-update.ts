import {
  ZOHO_LISTING_FIELDS,
  type ZohoListing,
  type ZohoListingState,
  formatZohoDateTime,
} from "./zoho-listing-fields.js";

export type ListingPlan =
  /** Zoho already shows this listing: nothing is sent. */
  | { kind: "unchanged" }
  /**
   * Zoho shows a listing written after these facts were read: whatever wrote it saw newer facts,
   * so this older picture is dropped rather than sent over it.
   */
  | { kind: "stale" }
  | { kind: "update"; fields: Record<string, string | null> };

const same = (a: string | null, b: string | null) => (a ?? "") === (b ?? "");

/** How far ahead a listing's time may be and still count as a newer write by LAX. */
export const STALE_WINDOW_MS = 10 * 60 * 1000;

/**
 * What to send for one Product. Only the four listing fields are ever written, and only when one
 * of them differs, so delivering twice sends once and Zoho's own fields are never touched.
 */
export function planListingUpdate(input: {
  wanted: ZohoListing;
  current: ZohoListingState;
  /** When the facts behind `wanted` were read. */
  observedAt: Date;
}): ListingPlan {
  const { wanted, current, observedAt } = input;
  if (
    same(current.value, wanted.value) &&
    same(current.detail, wanted.detail) &&
    same(current.link, wanted.link)
  ) {
    return { kind: "unchanged" };
  }
  if (current.updatedAt) {
    const ahead = current.updatedAt.getTime() - observedAt.getTime();
    // A time further ahead than any write in flight was not written by LAX; it never blocks.
    if (ahead > 0 && ahead <= STALE_WINDOW_MS) return { kind: "stale" };
  }
  return {
    kind: "update",
    fields: {
      [ZOHO_LISTING_FIELDS.value]: wanted.value,
      [ZOHO_LISTING_FIELDS.detail]: wanted.detail,
      [ZOHO_LISTING_FIELDS.link]: wanted.link,
      [ZOHO_LISTING_FIELDS.updated]: formatZohoDateTime(observedAt),
    },
  };
}
