import { MAX_REOFFERS_PER_DEFAULT } from "./reoffer-rules.js";

/**
 * One offer of a defaulted lot to one bidder. The record moves only through the table below; the
 * lot itself changes only when the bidder accepts.
 */
export const REOFFER_STATUSES = [
  "awaiting_seller",
  "ready",
  "offered",
  "accepted",
  "declined",
  "expired",
  "seller_declined",
  "seller_lapsed",
  "withdrawn",
] as const;
export type ReofferStatus = (typeof REOFFER_STATUSES)[number];

/** What can happen to an offer, by whom: the seller, the bidder, staff or the clock. */
export const REOFFER_EVENTS = [
  "seller_agreed",
  "seller_declined",
  "seller_lapsed",
  "offer_sent",
  "bidder_accepted",
  "bidder_declined",
  "offer_ended",
  "withdrawn",
] as const;
export type ReofferEvent = (typeof REOFFER_EVENTS)[number];

type Moves = Partial<Record<ReofferEvent, ReofferStatus>>;

/** The allowed moves. A status with no entry is final. */
const MOVES: Record<ReofferStatus, Moves> = {
  awaiting_seller: {
    seller_agreed: "ready",
    seller_declined: "seller_declined",
    seller_lapsed: "seller_lapsed",
    withdrawn: "withdrawn",
  },
  ready: { offer_sent: "offered", withdrawn: "withdrawn" },
  offered: {
    bidder_accepted: "accepted",
    bidder_declined: "declined",
    offer_ended: "expired",
    withdrawn: "withdrawn",
  },
  accepted: {},
  declined: {},
  expired: {},
  seller_declined: {},
  seller_lapsed: {},
  withdrawn: {},
};

export type ReofferTransition =
  | { ok: true; status: ReofferStatus }
  | { ok: false; reason: "final" | "not_allowed" };

/** The status an offer reaches on an event, or why it cannot. */
export function transitionReoffer(status: ReofferStatus, event: ReofferEvent): ReofferTransition {
  const moves = MOVES[status];
  if (Object.keys(moves).length === 0) return { ok: false, reason: "final" };
  const next = moves[event];
  return next ? { ok: true, status: next } : { ok: false, reason: "not_allowed" };
}

/** The events an offer accepts now; empty once it is final. */
export function allowedReofferEvents(status: ReofferStatus): ReofferEvent[] {
  return Object.keys(MOVES[status]) as ReofferEvent[];
}

export function isFinalReofferStatus(status: ReofferStatus): boolean {
  return Object.keys(MOVES[status]).length === 0;
}

/** Waiting on someone: at most one such offer exists per lot. */
export function isOpenReofferStatus(status: ReofferStatus): boolean {
  return !isFinalReofferStatus(status);
}

/** A final status that ended without a sale: staff offer to the next bidder or return the lot. */
export function endedWithoutSale(status: ReofferStatus): boolean {
  return isFinalReofferStatus(status) && status !== "accepted";
}

/**
 * Where a default stands, from all of its offers: an offer is still open, a bidder accepted
 * (re-offer done), or every offer ended without a sale and staff decide what is next.
 */
export type ReofferProgress =
  | { kind: "none" }
  | { kind: "open" }
  | { kind: "re_offered" }
  | { kind: "needs_decision"; canOfferAgain: boolean };

export function reofferProgress(statuses: readonly ReofferStatus[]): ReofferProgress {
  if (statuses.length === 0) return { kind: "none" };
  if (statuses.includes("accepted")) return { kind: "re_offered" };
  if (statuses.some(isOpenReofferStatus)) return { kind: "open" };
  return { kind: "needs_decision", canOfferAgain: statuses.length < MAX_REOFFERS_PER_DEFAULT };
}

/** How a lot's re-offer is finally settled: sold again, or back to inventory. */
export const REOFFER_RESOLUTIONS = ["re_offered", "returned_to_inventory"] as const;
export type ReofferResolution = (typeof REOFFER_RESOLUTIONS)[number];
