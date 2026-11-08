import { describe, expect, it } from "vitest";
import {
  COLLECTION_BOOKING_ACTIONS,
  COLLECTION_BOOKING_STATUSES,
  type CollectionActor,
  type CollectionBookingAction,
  type CollectionBookingStatus,
  type TransitionContext,
  allowedBookingActions,
  bookingIsActive,
  calendarMethodFor,
  transitionBooking,
} from "./collection-booking-state.js";
import { bankHolidayClosures, createCollectionCalendar } from "./collection-calendar.js";
import { DEFAULT_COLLECTION_RULES } from "./collection-rules.js";

const at = (iso: string) => new Date(iso);

const calendar = createCollectionCalendar({
  hours: [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    opensLocal: "10:00",
    closesLocal: "19:00",
  })),
  exceptions: bankHolidayClosures([2026]),
  rules: DEFAULT_COLLECTION_RULES,
});

/** A Tuesday 10:00 visit; the cut-off is Monday 9 November 16:00. */
const SLOT = at("2026-11-10T10:00:00Z");

const context = (over: Partial<TransitionContext> = {}): TransitionContext => ({
  status: "booked",
  actor: "client",
  now: at("2026-11-09T11:20:00Z"),
  slotStart: SLOT,
  rules: DEFAULT_COLLECTION_RULES,
  calendar,
  ...over,
});

describe("a booked visit, before the cut-off", () => {
  it("lets the client change it, which updates the calendar entry", () => {
    expect(transitionBooking("change", context())).toEqual({
      ok: true,
      status: "booked",
      calendarUpdate: true,
      auditEvent: "collection.booking.changed",
    });
  });

  it("lets the client cancel it, which removes the calendar entry", () => {
    expect(transitionBooking("cancel", context())).toEqual({
      ok: true,
      status: "cancelled",
      calendarUpdate: true,
      auditEvent: "collection.booking.cancelled",
    });
  });

  it("does not let the client hand over or mark it not collected", () => {
    for (const action of ["hand_over_all", "hand_over_some", "mark_not_collected"] as const) {
      expect(transitionBooking(action, context())).toEqual({
        ok: false,
        reason: "actor_not_allowed",
      });
    }
  });
});

describe("the 16:00 cut-off", () => {
  const client = (now: string, action: CollectionBookingAction) =>
    transitionBooking(action, context({ now: at(now) }));

  it.each(["change", "cancel"] as const)("lets the client %s up to 16:00 exactly", (action) => {
    expect(client("2026-11-09T15:59:00Z", action).ok).toBe(true);
    expect(client("2026-11-09T16:00:00.000Z", action).ok).toBe(true);
  });

  it.each(["change", "cancel"] as const)("stops the client %s a moment after 16:00", (action) => {
    expect(client("2026-11-09T16:00:00.001Z", action)).toEqual({
      ok: false,
      reason: "cutoff_passed",
    });
    expect(client("2026-11-10T09:00:00Z", action)).toEqual({ ok: false, reason: "cutoff_passed" });
  });

  it("is Friday 16:00 for a Monday visit", () => {
    const monday = at("2026-11-16T10:00:00Z");
    const when = (now: string) =>
      transitionBooking("change", context({ slotStart: monday, now: at(now) })).ok;
    expect(when("2026-11-13T16:00:00Z")).toBe(true);
    expect(when("2026-11-13T16:01:00Z")).toBe(false);
    expect(when("2026-11-15T12:00:00Z")).toBe(false);
  });

  it("moves with the clocks: 16:00 BST is 15:00 UTC", () => {
    const summer = at("2026-06-16T09:00:00Z");
    const when = (now: string) =>
      transitionBooking("cancel", context({ slotStart: summer, now: at(now) })).ok;
    expect(when("2026-06-15T15:00:00Z")).toBe(true);
    expect(when("2026-06-15T15:00:00.001Z")).toBe(false);
  });

  it("skips bank holidays", () => {
    // The visit is Tuesday 29 December 2026; the cut-off is Thursday 24 December 16:00.
    const visit = at("2026-12-29T10:00:00Z");
    const when = (now: string) =>
      transitionBooking("change", context({ slotStart: visit, now: at(now) })).ok;
    expect(when("2026-12-24T16:00:00Z")).toBe(true);
    expect(when("2026-12-24T16:01:00Z")).toBe(false);
  });

  it("lets staff change and cancel after the cut-off, and even after the visit has begun", () => {
    for (const now of ["2026-11-09T17:00:00Z", "2026-11-10T10:05:00Z"]) {
      for (const action of ["change", "cancel"] as const) {
        expect(transitionBooking(action, context({ actor: "staff", now: at(now) })).ok).toBe(true);
      }
    }
  });
});

describe("staff outcomes", () => {
  const staff = (action: CollectionBookingAction, now = "2026-11-10T10:05:00Z") =>
    transitionBooking(action, context({ actor: "staff", now: at(now) }));

  it("hands over everything: collected, no calendar update", () => {
    expect(staff("hand_over_all")).toEqual({
      ok: true,
      status: "collected",
      calendarUpdate: false,
      auditEvent: "collection.handed_over",
    });
  });

  it("hands over some lots: partly collected", () => {
    expect(staff("hand_over_some")).toEqual({
      ok: true,
      status: "partly_collected",
      calendarUpdate: false,
      auditEvent: "collection.handed_over",
    });
  });

  it("allows a hand-over when the buyer arrives early", () => {
    expect(staff("hand_over_all", "2026-11-10T09:40:00Z").ok).toBe(true);
  });

  it("marks not collected from the start of the visit, not before", () => {
    expect(staff("mark_not_collected", "2026-11-10T09:59:59.999Z")).toEqual({
      ok: false,
      reason: "too_early",
    });
    expect(staff("mark_not_collected", "2026-11-10T10:00:00.000Z")).toEqual({
      ok: true,
      status: "not_collected",
      calendarUpdate: false,
      auditEvent: "collection.not_collected",
    });
    expect(staff("mark_not_collected", "2026-11-11T09:00:00Z").ok).toBe(true);
  });
});

describe("undoing a hand-over", () => {
  const HANDED_OVER = at("2026-11-10T10:05:00Z");
  const undo = (over: Partial<TransitionContext>) =>
    transitionBooking(
      "undo_hand_over",
      context({ actor: "staff", status: "collected", handedOverAt: HANDED_OVER, ...over }),
    );

  it.each(["collected", "partly_collected"] as const)(
    "puts a %s booking back to booked, and records it",
    (status) => {
      expect(undo({ status, now: at("2026-11-10T10:07:00Z") })).toEqual({
        ok: true,
        status: "booked",
        calendarUpdate: false,
        auditEvent: "collection.hand_over_undone",
      });
    },
  );

  it("is open for 10 minutes, to the millisecond", () => {
    expect(undo({ now: at("2026-11-10T10:15:00.000Z") }).ok).toBe(true);
    expect(undo({ now: at("2026-11-10T10:15:00.001Z") })).toEqual({
      ok: false,
      reason: "undo_window_passed",
    });
  });

  it("follows the minutes the rules set", () => {
    const rules = { ...DEFAULT_COLLECTION_RULES, undoHandOverMinutes: 2 };
    expect(undo({ rules, now: at("2026-11-10T10:07:00Z") }).ok).toBe(true);
    expect(undo({ rules, now: at("2026-11-10T10:07:01Z") }).ok).toBe(false);
  });

  it("is refused when there is no record of when it was handed over", () => {
    expect(undo({ handedOverAt: null, now: HANDED_OVER })).toEqual({
      ok: false,
      reason: "undo_window_passed",
    });
    expect(undo({ handedOverAt: undefined, now: HANDED_OVER }).ok).toBe(false);
  });

  it("is for staff only", () => {
    expect(undo({ actor: "client", now: HANDED_OVER })).toEqual({
      ok: false,
      reason: "actor_not_allowed",
    });
  });

  it("applies only to a handed-over booking", () => {
    for (const status of ["booked", "not_collected", "cancelled"] as const) {
      expect(undo({ status, now: HANDED_OVER })).toEqual({ ok: false, reason: "booking_closed" });
    }
  });

  it("can be followed by a new hand-over", () => {
    const back = undo({ now: at("2026-11-10T10:06:00Z") });
    expect(back).toMatchObject({ ok: true, status: "booked" });
    const again = transitionBooking(
      "hand_over_all",
      context({ actor: "staff", status: "booked", now: at("2026-11-10T10:08:00Z") }),
    );
    expect(again).toMatchObject({ ok: true, status: "collected" });
  });

  it("shows as an available action only inside the window", () => {
    const inside = allowedBookingActions(
      context({
        actor: "staff",
        status: "collected",
        handedOverAt: HANDED_OVER,
        now: at("2026-11-10T10:10:00Z"),
      }),
    );
    expect(inside).toEqual(["undo_hand_over"]);
    const outside = allowedBookingActions(
      context({
        actor: "staff",
        status: "collected",
        handedOverAt: HANDED_OVER,
        now: at("2026-11-10T11:00:00Z"),
      }),
    );
    expect(outside).toEqual([]);
  });
});

describe("every other state is final", () => {
  const closed = COLLECTION_BOOKING_STATUSES.filter((s) => s !== "booked");
  const handedOver = new Set(["collected", "partly_collected"]);

  it.each(closed)("%s accepts no action from anyone, bar the timed undo", (status) => {
    for (const actor of ["client", "staff"] as const) {
      for (const action of COLLECTION_BOOKING_ACTIONS) {
        if (action === "undo_hand_over" && handedOver.has(status)) continue;
        expect(
          transitionBooking(action, context({ status, actor, now: at("2026-11-10T11:00:00Z") })),
        ).toEqual({ ok: false, reason: "booking_closed" });
      }
    }
  });
});

describe("the full table", () => {
  const expected: Record<CollectionActor, Record<CollectionBookingAction, boolean>> = {
    client: {
      change: true,
      cancel: true,
      hand_over_all: false,
      hand_over_some: false,
      undo_hand_over: false,
      mark_not_collected: false,
    },
    staff: {
      change: true,
      cancel: true,
      hand_over_all: true,
      hand_over_some: true,
      undo_hand_over: false,
      mark_not_collected: true,
    },
  };

  it.each(["client", "staff"] as const)(
    "gives a %s the actions the rules allow on a booked visit during the visit",
    (actor) => {
      // During the visit: the client is past the cut-off, so only staff act.
      for (const action of COLLECTION_BOOKING_ACTIONS) {
        const result = transitionBooking(
          action,
          context({ actor, now: at("2026-11-10T10:05:00Z") }),
        );
        const allowedByRole = expected[actor][action];
        const clientPastCutoff = actor === "client" && (action === "change" || action === "cancel");
        expect(result.ok).toBe(allowedByRole && !clientPastCutoff);
      }
    },
  );

  it("lists the actions a person can take, to show or hide buttons", () => {
    expect(allowedBookingActions(context())).toEqual(["change", "cancel"]);
    expect(allowedBookingActions(context({ now: at("2026-11-09T17:00:00Z") }))).toEqual([]);
    expect(
      allowedBookingActions(context({ actor: "staff", now: at("2026-11-10T10:05:00Z") })),
    ).toEqual(["change", "cancel", "hand_over_all", "hand_over_some", "mark_not_collected"]);
    expect(allowedBookingActions(context({ status: "cancelled", actor: "staff" }))).toEqual([]);
  });
});

describe("helpers", () => {
  it("holds places and lots only while booked", () => {
    const active = COLLECTION_BOOKING_STATUSES.filter(bookingIsActive);
    expect(active).toEqual(["booked"]);
  });

  it("sends REQUEST for every state but cancelled", () => {
    const methods = Object.fromEntries(
      COLLECTION_BOOKING_STATUSES.map((s: CollectionBookingStatus) => [s, calendarMethodFor(s)]),
    );
    expect(methods).toEqual({
      booked: "REQUEST",
      collected: "REQUEST",
      partly_collected: "REQUEST",
      not_collected: "REQUEST",
      cancelled: "CANCEL",
    });
  });
});
