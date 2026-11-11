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

/** The moves each status allows. */
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

/** Who may cause each event. Staff act for the seller by recording an answer they were given. */
const EVENT_ACTORS: Record<ReofferEvent, readonly ReofferActor[]> = {
  seller_agreed: ["seller", "staff"],
  seller_declined: ["seller", "staff"],
  seller_lapsed: ["clock"],
  offer_sent: ["staff"],
  bidder_accepted: ["bidder"],
  bidder_declined: ["bidder"],
  offer_ended: ["clock"],
  withdrawn: ["staff"],
};

/**
 * Moves only staff can make: a seller whose window lapsed can still give an answer by phone or
 * email, and staff record it on the same request. Whether that is still safe depends on the
 * other offers of the default: see `canReopenLapsedRequest`.
 */
const STAFF_MOVES: Partial<Record<ReofferStatus, Moves>> = {
  seller_lapsed: { seller_agreed: "ready", seller_declined: "seller_declined" },
};

function movesFor(status: ReofferStatus, actor: ReofferActor): Moves {
  return actor === "staff" ? { ...MOVES[status], ...STAFF_MOVES[status] } : MOVES[status];
}

function actorMayCause(event: ReofferEvent, actor: ReofferActor): boolean {
  return EVENT_ACTORS[event].includes(actor);
}

export type ReofferTransition =
  | { ok: true; status: ReofferStatus }
  | { ok: false; reason: "final" | "not_allowed" };

/** The status an offer reaches on an event by an actor, or why it cannot. */
export function transitionReoffer(
  status: ReofferStatus,
  event: ReofferEvent,
  actor: ReofferActor,
): ReofferTransition {
  const next = movesFor(status, actor)[event];
  if (next && actorMayCause(event, actor)) return { ok: true, status: next };
  return { ok: false, reason: isFinalReofferStatus(status) ? "final" : "not_allowed" };
}

/** The events an offer accepts now from this actor. */
export function allowedReofferEvents(status: ReofferStatus, actor: ReofferActor): ReofferEvent[] {
  return (Object.keys(movesFor(status, actor)) as ReofferEvent[]).filter((event) =>
    actorMayCause(event, actor),
  );
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

/** An offer as the rules see it: its status, and when the bidder was sent it (`null` if never). */
export type ReofferRecord = {
  status: ReofferStatus;
  offerSentAt: Date | null;
};

/** Whether the bidder was ever offered the lot. A seller's no or silence never reaches them. */
export function offerReachedBidder(record: ReofferRecord): boolean {
  return record.offerSentAt !== null;
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
 * Whether staff may reopen the lapsed request by recording the seller's late answer. Only the
 * latest offer can be reopened, and only while no later offer exists: otherwise the lot could be
 * awarded through two offers at once. After a lapse the paths are this one, or returning the lot.
 */
export function canReopenLapsedRequest(records: readonly ReofferRecord[]): boolean {
  return records[records.length - 1]?.status === "seller_lapsed";
}

/**
 * Where a default stands, from all of its offers in the order they were made: an offer is still
 * open, a bidder accepted, or every offer ended without a sale and staff decide. After the
 * seller declined or did not reply, no further offer is made: staff record a late answer on the
 * same request, or return the lot or follow the seller's preference.
 */
export type ReofferProgress =
  | { kind: "none" }
  | { kind: "open" }
  | { kind: "re_offered" }
  | { kind: "needs_decision"; canOfferAgain: boolean };

const SELLER_SIDE_ENDS: readonly ReofferStatus[] = ["seller_declined", "seller_lapsed"];

export function reofferProgress(records: readonly ReofferRecord[]): ReofferProgress {
  const last = records[records.length - 1];
  if (!last) return { kind: "none" };
  if (records.some((record) => record.status === "accepted")) return { kind: "re_offered" };
  if (records.some((record) => isOpenReofferStatus(record.status))) return { kind: "open" };
  return {
    kind: "needs_decision",
    canOfferAgain: !capReached(records) && !SELLER_SIDE_ENDS.includes(last.status),
  };
}

/** What a bidder is told of an offer: only the bidder's own steps, never the seller's. */
export const BIDDER_REOFFER_STATUSES = [
  "offered",
  "accepted",
  "declined",
  "ended",
  "withdrawn",
] as const;
export type BidderReofferStatus = (typeof BIDDER_REOFFER_STATUSES)[number];

/**
 * The status the bidder sees, or `null` when the bidder has no offer to see (the seller has not
 * agreed, the seller said no or did not reply, or the offer was withdrawn before it was sent).
 */
export function bidderReofferStatus(record: ReofferRecord): BidderReofferStatus | null {
  switch (record.status) {
    case "offered":
    case "accepted":
    case "declined":
      return record.status;
    case "expired":
      return "ended";
    case "withdrawn":
      return offerReachedBidder(record) ? "withdrawn" : null;
    default:
      return null;
  }
}
