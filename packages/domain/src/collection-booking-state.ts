import { type CollectionCalendar, type NoticeWindow, noticeWindow } from "./collection-calendar.js";
import type { CollectionRules } from "./collection-rules.js";

export const COLLECTION_BOOKING_STATUSES = [
  "booked",
  "collected",
  "partly_collected",
  "not_collected",
  "cancelled",
] as const;
export type CollectionBookingStatus = (typeof COLLECTION_BOOKING_STATUSES)[number];

/** What can be done to a booking. A rebook is a new booking, not a transition. */
export type CollectionBookingAction =
  | "change"
  | "cancel"
  | "hand_over_all"
  | "hand_over_some"
  | "mark_not_collected";

export type CollectionActor = "client" | "staff";

export type TransitionRefusal =
  /** The booking has already ended (collected, not collected, cancelled). */
  | "booking_closed"
  /** This kind of person may not do this. */
  | "actor_not_allowed"
  /** A client's change or cancel after the 16:00 cut-off. */
  | "cutoff_passed"
  /** Not collected can only be marked from the start of the visit. */
  | "too_early";

export type TransitionContext = {
  status: CollectionBookingStatus;
  actor: CollectionActor;
  now: Date;
  slotStart: Date;
  rules: Pick<CollectionRules, "noticeCutoffLocal" | "noticeWorkingDays">;
  calendar: CollectionCalendar;
};

export type TransitionResult =
  | {
      ok: true;
      status: CollectionBookingStatus;
      /** Whether the calendar entry changes: its SEQUENCE goes up and an update is sent. */
      calendarUpdate: boolean;
    }
  | { ok: false; reason: TransitionRefusal };

type TransitionRule = {
  /** The statuses the action can start from. */
  from: readonly CollectionBookingStatus[];
  actors: readonly CollectionActor[];
  to: CollectionBookingStatus;
  calendarUpdate: boolean;
  /** An extra condition, checked after the actor; returns a refusal or `null`. */
  guard?: (context: TransitionContext, notice: NoticeWindow) => TransitionRefusal | null;
};

/** A client changes or cancels only inside the notice window; staff may at any time. */
const clientInsideNotice: NonNullable<TransitionRule["guard"]> = (context, notice) =>
  context.actor === "client" && !notice.open ? "cutoff_passed" : null;

/**
 * Who may move a booking where. Booked is the only open state; every other state is final, and
 * a missed or partly collected visit is followed by a new booking.
 */
const TRANSITIONS: Record<CollectionBookingAction, TransitionRule> = {
  change: {
    from: ["booked"],
    actors: ["client", "staff"],
    to: "booked",
    calendarUpdate: true,
    guard: clientInsideNotice,
  },
  cancel: {
    from: ["booked"],
    actors: ["client", "staff"],
    to: "cancelled",
    calendarUpdate: true,
    guard: clientInsideNotice,
  },
  hand_over_all: { from: ["booked"], actors: ["staff"], to: "collected", calendarUpdate: false },
  hand_over_some: {
    from: ["booked"],
    actors: ["staff"],
    to: "partly_collected",
    calendarUpdate: false,
  },
  mark_not_collected: {
    from: ["booked"],
    actors: ["staff"],
    to: "not_collected",
    calendarUpdate: false,
    guard: (context) => (context.now < context.slotStart ? "too_early" : null),
  },
};

export const COLLECTION_BOOKING_ACTIONS = Object.keys(
  TRANSITIONS,
) as readonly CollectionBookingAction[];

/** Applies an action to a booking: the new status, or why it cannot be done. */
export function transitionBooking(
  action: CollectionBookingAction,
  context: TransitionContext,
): TransitionResult {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(context.status)) return { ok: false, reason: "booking_closed" };
  if (!rule.actors.includes(context.actor)) return { ok: false, reason: "actor_not_allowed" };
  const notice = noticeWindow(context.now, context.slotStart, context.rules, context.calendar);
  const refusal = rule.guard?.(context, notice) ?? null;
  if (refusal) return { ok: false, reason: refusal };
  return { ok: true, status: rule.to, calendarUpdate: rule.calendarUpdate };
}

/** The actions the person can take now, for showing or hiding buttons. */
export function allowedBookingActions(context: TransitionContext): CollectionBookingAction[] {
  return COLLECTION_BOOKING_ACTIONS.filter((action) => transitionBooking(action, context).ok);
}

/** Whether the booking still holds its places and lots. */
export function bookingIsActive(status: CollectionBookingStatus): boolean {
  return status === "booked";
}

/** The calendar method for the booking's current state: a cancelled booking removes the entry. */
export function calendarMethodFor(status: CollectionBookingStatus): "REQUEST" | "CANCEL" {
  return status === "cancelled" ? "CANCEL" : "REQUEST";
}
