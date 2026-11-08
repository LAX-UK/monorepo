/**
 * What the collection booking API sends. Times are ISO 8601 instants (UTC); the screens show them
 * in London time with the zone, in the one date style. No prices appear anywhere.
 */

export type CollectionSlotView = {
  start: string;
  end: string;
  placesLeft: number;
  state: "open" | "full" | "too_soon";
};

export type CollectionDayView = {
  /** The London calendar day, "2026-11-12". */
  date: string;
  state: "open" | "full" | "closed" | "sale_day" | "too_soon";
  /** Times a buyer can book that day ("7 times"). */
  openSlots: number;
  slots: CollectionSlotView[];
};

/** A lot the person wants to collect, and whether it can be ticked. */
export type CollectionLotLine = {
  lotId: string;
  title: string;
  lotNumber: number | null;
  collectable: boolean;
  /** Why not, as a key and as the sentence to show; `null` when collectable. */
  blockedReason: string | null;
  blockedMessage: string | null;
};

export type CollectionAvailability = {
  venueId: string;
  /** False while staff have not switched online booking on for the place: show the email route. */
  onlineBookingEnabled: boolean;
  bookingEmail: string | null;
  visitMinutes: number;
  windowDays: number;
  /** The cut-off on the working day before a visit, "16:00" London time. */
  noticeCutoffLocal: string;
  timeZone: "Europe/London";
  /** The first time that can be booked, or `null` when the window has none. */
  earliest: string | null;
  days: CollectionDayView[];
  lots: CollectionLotLine[];
};

export type CollectionVisitStatus =
  | "booked"
  | "collected"
  | "partly_collected"
  | "not_collected"
  | "cancelled";

export type CollectionVisitAction = "change" | "cancel";

export type CollectionVisitView = {
  id: string;
  /** "COL-1042". */
  reference: string;
  status: CollectionVisitStatus;
  start: string;
  end: string;
  /** The booking as last read; send it back with a change or cancellation. */
  version: number;
  lots: {
    lotId: string;
    title: string;
    lotNumber: number | null;
    active: boolean;
    outcome: "collected" | "left" | null;
  }[];
  collector: {
    kind: "self" | "member" | "third_party";
    name: string;
    email: string | null;
    company: string | null;
  };
  authorisedAt: string | null;
  /** Whether the person asking made the booking (another member's is shown without who). */
  bookedByYou: boolean;
  bookedVia: "client" | "staff";
  /** The last moment to change or cancel online; `null` once it is over or not known. */
  noticeDeadline: string | null;
  /** What this person can still do online. */
  actions: CollectionVisitAction[];
  handedOverAt: string | null;
  cancelledAt: string | null;
};
