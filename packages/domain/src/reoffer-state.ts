import { MAX_REOFFERS_PER_DEFAULT } from "./reoffer-rules.js";

/**
 * One offer of a defaulted lot to one bidder. The record moves only through the tables below;
 * the lot itself changes only when the bidder accepts.
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

/** What can happen to an offer. */
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

/** Who moves the offer: the seller, the bidder, staff (also on someone's behalf), or the clock. */
export type ReofferActor = "seller" | "bidder" | "staff" | "clock";

type Moves = Partial<Record<ReofferEvent, ReofferStatus>>;

/** The moves open to every actor. */
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

/**
 * Moves only staff can make: a seller whose window lapsed can still give an answer by phone or
 * email, and staff record it, which reopens the same request.
 */
const STAFF_MOVES: Partial<Record<ReofferStatus, Moves>> = {
  seller_lapsed: { seller_agreed: "ready", seller_declined: "seller_declined" },
};

function movesFor(status: ReofferStatus, actor: ReofferActor): Moves {
  return actor === "staff" ? { ...MOVES[status], ...STAFF_MOVES[status] } : MOVES[status];
}

export type ReofferTransition =
  | { ok: true; status: ReofferStatus }
  | { ok: false; reason: "final" | "not_allowed" };

/** The status an offer reaches on an event by an actor, or why it cannot. */
export function transitionReoffer(
  status: ReofferStatus,
  event: ReofferEvent,
  actor: ReofferActor = "seller",
): ReofferTransition {
  const next = movesFor(status, actor)[event];
  if (next) return { ok: true, status: next };
  return { ok: false, reason: isFinalReofferStatus(status) ? "final" : "not_allowed" };
}

/** The events an offer accepts now from this actor. */
export function allowedReofferEvents(
  status: ReofferStatus,
  actor: ReofferActor = "seller",
): ReofferEvent[] {
  return Object.keys(movesFor(status, actor)) as ReofferEvent[];
}

/** No move is left for anyone. A lapsed request is not final: staff can still record an answer. */
export function isFinalReofferStatus(status: ReofferStatus): boolean {
  return (
    Object.keys(MOVES[status]).length === 0 && Object.keys(STAFF_MOVES[status] ?? {}).length === 0
  );
}

const OPEN_STATUSES: readonly ReofferStatus[] = ["awaiting_seller", "ready", "offered"];

/** Waiting on someone: at most one such offer exists per lot. */
export function isOpenReofferStatus(status: ReofferStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

/** Closed without a sale: staff offer to the next bidder or return the lot. */
export function endedWithoutSale(status: ReofferStatus): boolean {
  return !isOpenReofferStatus(status) && status !== "accepted";
}

/** An offer as the rules see it: its status, and whether the bidder was ever sent it. */
export type ReofferRecord = {
  status: ReofferStatus;
  /** Needed only for a withdrawn offer: whether it was withdrawn after it reached the bidder. */
  sentToBidder?: boolean;
};

const REACHED_BIDDER: readonly ReofferStatus[] = ["offered", "accepted", "declined", "expired"];

/** Whether the bidder was ever offered the lot. A seller's no or silence never reaches them. */
export function offerReachedBidder(record: ReofferRecord): boolean {
  return (
    REACHED_BIDDER.includes(record.status) ||
    (record.status === "withdrawn" && record.sentToBidder === true)
  );
}

/**
 * The offers that count toward the cap of three per default: only those a bidder actually
 * received. The one rule for the cap, used by selection, progress and the start guard.
 */
export function offersCountedTowardCap(records: readonly ReofferRecord[]): number {
  return records.filter(offerReachedBidder).length;
}

export function capReached(records: readonly ReofferRecord[]): boolean {
  return offersCountedTowardCap(records) >= MAX_REOFFERS_PER_DEFAULT;
}

/**
 * Where a default stands, from all of its offers in the order they were made: an offer is still
 * open, a bidder accepted, or every offer ended without a sale and staff decide. After the
 * seller declined, no further offer is made: staff return the lot or follow the seller's
 * preference.
 */
export type ReofferProgress =
  | { kind: "none" }
  | { kind: "open" }
  | { kind: "re_offered" }
  | { kind: "needs_decision"; canOfferAgain: boolean };

export function reofferProgress(records: readonly ReofferRecord[]): ReofferProgress {
  const last = records[records.length - 1];
  if (!last) return { kind: "none" };
  if (records.some((record) => record.status === "accepted")) return { kind: "re_offered" };
  if (records.some((record) => isOpenReofferStatus(record.status))) return { kind: "open" };
  return {
    kind: "needs_decision",
    canOfferAgain: !capReached(records) && last.status !== "seller_declined",
  };
}
