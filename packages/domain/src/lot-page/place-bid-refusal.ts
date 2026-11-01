import { moneyLt } from "../money-compare.js";
import { type NextBidLot, nextBidAmount } from "./next-bid.js";

/** The refusals a bid dialog can phrase, each with a small payload of facts. */
export const PLACE_BID_ERROR_CODES = {
  outbid_during_confirm: "outbid_during_confirm",
  over_limit: "over_limit",
  registration_required: "registration_required",
  registration_pending: "registration_pending",
  lot_closed: "lot_closed",
  amount_invalid: "amount_invalid",
} as const;

export type PlaceBidErrorCode = (typeof PLACE_BID_ERROR_CODES)[keyof typeof PLACE_BID_ERROR_CODES];

export type PlaceBidErrorDetails = Readonly<Record<string, string>>;

export type TypedPlaceBidRefusal = {
  code: PlaceBidErrorCode;
  details: PlaceBidErrorDetails;
};

/** Codes the bidding channels raise internally, and the typed code a bid dialog receives. */
const TYPED_CODE_BY_RAISED_CODE: Readonly<Record<string, PlaceBidErrorCode>> = {
  sale_registration_required: "registration_required",
  sale_registration_pending: "registration_pending",
  bid_limit_exceeded: "over_limit",
  authorisation_total_limit_exceeded: "over_limit",
  organisation_limit_exceeded: "over_limit",
};

/**
 * Presents a raised refusal in its typed form. A code that is already typed, or not one of the
 * dialog's concern, comes back as `null` and is sent as it was raised.
 */
export function typedPlaceBidRefusal(
  code: string | undefined,
  details: PlaceBidErrorDetails | undefined,
): TypedPlaceBidRefusal | null {
  if (!code) return null;
  const typed = TYPED_CODE_BY_RAISED_CODE[code];
  if (!typed) return null;
  if (typed !== "over_limit") return { code: typed, details: details ?? {} };
  // The room left under the binding limit: the most the bidder can still commit to.
  const remaining = details?.available ?? details?.remaining;
  return { code: typed, details: { ...(details ?? {}), ...(remaining ? { remaining } : {}) } };
}

/**
 * Why an amount below the minimum was refused. A bidder who confirmed against an older next bid
 * was outbid while confirming; anyone else sent an amount the lot does not accept. Both are told
 * the amount to use.
 */
export function amountRefusal(input: {
  lot: NextBidLot;
  /** The next bid the bidder was shown when they confirmed. */
  seenNextBid?: string | null | undefined;
}): TypedPlaceBidRefusal {
  const next = nextBidAmount(input.lot);
  if (input.seenNextBid && moneyLt(input.seenNextBid, next)) {
    return { code: "outbid_during_confirm", details: { nextBidAmount: next } };
  }
  return { code: "amount_invalid", details: { nearestValidAmount: next } };
}

const CLOSED_STATUSES: ReadonlySet<string> = new Set(["ended", "cancelled", "voided"]);

/** Whether a lot status means bidding is over (a scheduled lot is not closed, only not open yet). */
export function isBiddingClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.has(status);
}
