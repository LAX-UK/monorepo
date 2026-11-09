/**
 * What the staff desk for collections shows. Times are ISO 8601 instants; the screens draw them in
 * London time. The ID number and a copy of the ID are never held: only its type.
 */

export type DeskIdType =
  | "passport"
  | "driving_licence"
  | "national_identity_card"
  | "other_photo_id";

export type DeskFulfilmentStatus =
  | "awaiting_payment"
  | "awaiting_release"
  | "released"
  | "ready_for_collection"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "none";

export type DeskLotView = {
  lotId: string;
  title: string;
  lotNumber: number | null;
  image: string | null;
  /** Staff have released the lot (or marked it ready), so it can be handed over. */
  released: boolean;
  fulfilmentStatus: DeskFulfilmentStatus;
  /** Still held by the booking, so it can be ticked at hand-over. */
  active: boolean;
  outcome: "collected" | "left" | null;
};

export type DeskBookingStatus =
  | "booked"
  | "collected"
  | "partly_collected"
  | "not_collected"
  | "cancelled";

export type DeskAction = "hand_over" | "not_collected" | "undo" | "rebook";

export type DeskBookingView = {
  id: string;
  reference: string;
  status: DeskBookingStatus;
  start: string;
  end: string;
  /** The booking as last read; sent back with a rebook. */
  version: number;
  buyer: { id: string; name: string };
  bookedVia: "client" | "staff";
  overCapacity: boolean;
  collector: {
    kind: "self" | "member" | "third_party";
    name: string;
    company: string | null;
  };
  lots: DeskLotView[];
  idCheckType: DeskIdType | null;
  /** When the hand-over was recorded. */
  handedOverAt: string | null;
  /** The last moment a hand-over can be undone. */
  undoUntil: string | null;
  /** What staff can do to the booking now. */
  actions: DeskAction[];
  /** Why a hand-over cannot be done yet ("a lot is not released"), or `null` when it can. */
  handOverBlocked: "not_released" | null;
};

export type DeskGroupView = {
  start: string;
  end: string;
  /** Places taken in this time. */
  taken: number;
  /** Places at once. */
  capacity: number;
  bookings: DeskBookingView[];
};

export type DeskDayState = "open" | "closed" | "sale_day";

export type DeskDayView = {
  venueId: string;
  /** The London day, "2026-11-12". */
  date: string;
  state: DeskDayState;
  /** A sale day can be opened anyway. */
  canOpenAnyway: boolean;
  capacity: number;
  visitMinutes: number;
  /** Times the day offers that have no booking yet. */
  openTimes: number;
  groups: DeskGroupView[];
  /** Visits on the day still to hand over, for the nav count. */
  toHandOver: number;
  /** Visits marked not collected that nobody has rebooked. */
  notCollected: number;
};

export type DeskListView = {
  venueId: string;
  status: "upcoming" | "not_collected";
  items: DeskBookingView[];
};
