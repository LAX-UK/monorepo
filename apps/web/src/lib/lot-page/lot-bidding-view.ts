import { isIndexableObject } from "@/lib/data/http/object-guards";

/**
 * What the lot detail response carries beyond the lot itself: the server clock, the next valid
 * bid and, once a lot has sold, its public price. The lot parser keeps the lot's own fields;
 * this reads the rest so the page never recomputes a server rule.
 */
export type LotBiddingView = {
  /** The server clock when the response was made (ISO), for the countdown's offset. */
  serverNow: string | null;
  nextBidAmount: string | null;
  hammerPrice: string | null;
  soldForWithPremium: string | null;
};

export const EMPTY_LOT_BIDDING_VIEW: LotBiddingView = {
  serverNow: null,
  nextBidAmount: null,
  hammerPrice: null,
  soldForWithPremium: null,
};

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function isoOrNull(value: unknown): string | null {
  const text = stringOrNull(value);
  return text !== null && !Number.isNaN(Date.parse(text)) ? text : null;
}

/** Reads the bidding fields off a lot detail payload; anything missing stays `null`. */
export function parseLotBiddingView(raw: unknown): LotBiddingView {
  if (!isIndexableObject(raw)) return EMPTY_LOT_BIDDING_VIEW;
  return {
    serverNow: isoOrNull(raw.serverNow),
    nextBidAmount: stringOrNull(raw.nextBidAmount),
    hammerPrice: stringOrNull(raw.hammerPrice),
    soldForWithPremium: stringOrNull(raw.soldForWithPremium),
  };
}
