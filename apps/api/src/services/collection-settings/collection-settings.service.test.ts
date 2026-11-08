import type { SaveCollectionSettingsBody } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  InMemoryCollectionSettings,
  InMemorySettingsBookings,
  RecordedEvents,
  SETTINGS_NOW,
  SETTINGS_VENUE,
  visitOn,
} from "../../testing/in-memory-collection-settings.js";
import { CollectionSettingsAdminService } from "./collection-settings.service.js";

const STAFF = { userId: "fulfilment-1" };

function setup(bookings = new InMemorySettingsBookings()) {
  const store = new InMemoryCollectionSettings();
  const events = new RecordedEvents();
  const service = new CollectionSettingsAdminService({
    settings: store,
    bookings,
    events,
    now: () => SETTINGS_NOW,
  });
  return { service, store, events, bookings };
}

/** The body that saves the settings exactly as they stand, with a change on top. */
function saveBody(
  store: InMemoryCollectionSettings,
  over: Partial<SaveCollectionSettingsBody> = {},
): SaveCollectionSettingsBody {
  const s = store.settings;
  return {
    version: s.updatedAt.toISOString(),
    onlineBookingEnabled: s.onlineBookingEnabled,
    visitMinutes: s.visitMinutes,
    placesPerSlot: s.placesPerSlot,
    noticeCutoffLocal: s.noticeCutoffLocal,
    noticeWorkingDays: s.noticeWorkingDays,
    windowDays: s.windowDays,
    closeOnSaleDays: s.closeOnSaleDays,
    undoHandOverMinutes: s.undoHandOverMinutes,
    freeStorageDays: s.freeStorageDays,
    bookingEmail: s.bookingEmail,
    hours: store.hours.map((h) => ({ ...h })),
    ...over,
  };
}

const hours = (closes: string) =>
  [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opensLocal: "10:00", closesLocal: closes }));

const failed = <T>(result: { _unsafeUnwrapErr(): T }) => result._unsafeUnwrapErr();

describe("reading", () => {
  it("lists the places staff can set up", async () => {
    const { service } = setup();
    expect(await service.venues()).toEqual([
      expect.objectContaining({ venueId: SETTINGS_VENUE, hasPlace: true }),
    ]);
  });

  it("gives the settings, the hours and the closures, with a version to send back", async () => {
    const { service, store } = setup();
    store.saleDays.push({
      id: null,
      kind: "closure",
      startsOn: "2026-11-26",
      endsOn: "2026-11-26",
      opensLocal: null,
      closesLocal: null,
      source: "sale",
      reasonInternal: null,
      saleId: "sale-1",
      saleTitle: "Winter Works on Paper: Live",
      createdByUserId: null,
      createdAt: null,
    });
    const view = (await service.get(SETTINGS_VENUE))._unsafeUnwrap();
    expect(view).toMatchObject({
      venueId: SETTINGS_VENUE,
      version: "2026-11-01T09:00:00.000Z",
      onlineBookingEnabled: false,
      visitMinutes: 30,
      placesPerSlot: 2,
      noticeCutoffLocal: "16:00",
      windowDays: 28,
      closeOnSaleDays: true,
      nextSaleDay: { saleTitle: "Winter Works on Paper: Live", startsOn: "2026-11-26" },
    });
    expect(view.hours).toHaveLength(5);
    expect(view.exceptions[0]).toMatchObject({
      source: "sale",
      saleTitle: "Winter Works on Paper: Live",
      canRemove: false,
      id: null,
    });
  });

  it("says when the place does not exist", async () => {
    const { service } = setup();
    expect(failed(await service.get("d0000000-0000-4000-8000-0000000000ff"))).toMatchObject({
      code: "venue_not_found",
      status: 404,
    });
  });
});

describe("saving", () => {
  it("saves the switch, the rules and the hours, and records only the names of what changed", async () => {
    const { service, store, events } = setup();
    const result = (
      await service.save(
        STAFF,
        SETTINGS_VENUE,
        saveBody(store, {
          onlineBookingEnabled: true,
          visitMinutes: 45,
          bookingEmail: "collections@lax.example",
          hours: hours("18:00"),
        }),
      )
    )._unsafeUnwrap();
    expect(result.cancelled).toBe(0);
    expect(result.affected).toEqual([]);
    expect(result.settings).toMatchObject({
      onlineBookingEnabled: true,
      visitMinutes: 45,
      bookingEmail: "collections@lax.example",
      version: SETTINGS_NOW.toISOString(),
    });
    expect(result.settings.hours.every((h) => h.closesLocal === "18:00")).toBe(true);
    expect(events.events).toHaveLength(1);
    expect(events.events[0]).toMatchObject({
      aggregateType: "collection_place",
      aggregateId: SETTINGS_VENUE,
      eventType: "collection.place.updated",
      actorUserId: "fulfilment-1",
    });
    expect(events.events[0]?.payload).toMatchObject({
      changed: ["online_booking_enabled", "visit_minutes", "booking_email", "weekly_hours"],
      affectedBookings: 0,
      affectedHandling: "none",
    });
    expect(JSON.stringify(events.events[0]?.payload)).not.toContain("collections@lax.example");
  });

  it("changes nothing and records a save that changes nothing as no change", async () => {
    const { service, store, events } = setup();
    await service.save(STAFF, SETTINGS_VENUE, saveBody(store));
    expect(events.events[0]?.payload).toMatchObject({ changed: [] });
  });

  it("names each field that cannot be saved, hours by day and range, and stores nothing", async () => {
    const { service, store, events } = setup();
    const error = failed(
      await service.save(
        STAFF,
        SETTINGS_VENUE,
        saveBody(store, {
          visitMinutes: 25,
          windowDays: 2,
          hours: [
            { weekday: 5, opensLocal: "10:00", closesLocal: "09:00" },
            { weekday: 2, opensLocal: "10:00", closesLocal: "13:00" },
            { weekday: 2, opensLocal: "12:00", closesLocal: "19:00" },
          ],
        }),
      ),
    );
    expect(error).toMatchObject({ code: "settings_invalid", status: 422 });
    expect(error.issues?.rules).toEqual(["visit_minutes", "window_days"]);
    expect(error.issues?.hours).toEqual([
      { weekday: 5, index: 0, code: "closes_not_after_opens" },
      { weekday: 2, index: 1, code: "overlap" },
    ]);
    expect(store.settings.visitMinutes).toBe(30);
    expect(events.events).toHaveLength(0);
  });

  it("refuses a save made on a copy someone else has since changed", async () => {
    const { service, store } = setup();
    const body = saveBody(store);
    await service.save(STAFF, SETTINGS_VENUE, saveBody(store, { visitMinutes: 20 }));
    const error = failed(await service.save({ userId: "other-1" }, SETTINGS_VENUE, body));
    expect(error).toMatchObject({ code: "settings_changed", status: 409 });
    expect(store.settings.visitMinutes).toBe(20);
  });

  it("says when the place does not exist", async () => {
    const { service, store } = setup();
    const error = failed(
      await service.save(STAFF, "d0000000-0000-4000-8000-0000000000ff", saveBody(store)),
    );
    expect(error.code).toBe("venue_not_found");
  });
});

describe("a change that touches bookings", () => {
  const friday = (id: string, time: string) => visitOn(id, `2026-11-13T${time}:00Z`);
  const withLateBookings = () =>
    setup(
      new InMemorySettingsBookings([
        friday("1001", "17:30"),
        friday("1002", "18:00"),
        friday("1003", "11:00"),
      ]),
    );

  it("lists them and changes nothing until staff choose", async () => {
    const { service, store, events } = withLateBookings();
    const error = failed(
      await service.save(STAFF, SETTINGS_VENUE, saveBody(store, { hours: hours("17:00") })),
    );
    expect(error).toMatchObject({ code: "bookings_affected", status: 409 });
    expect(error.affected).toEqual([
      {
        bookingId: expect.any(String),
        reference: "COL-1001",
        start: "2026-11-13T17:30:00.000Z",
        end: "2026-11-13T18:00:00.000Z",
        reason: "outside_hours",
      },
      expect.objectContaining({ reference: "COL-1002", reason: "outside_hours" }),
    ]);
    expect(store.hours.every((h) => h.closesLocal === "19:00")).toBe(true);
    expect(events.events).toHaveLength(0);
  });

  it("keeps them booked when staff say so, and records the choice", async () => {
    const { service, store, events, bookings } = withLateBookings();
    const result = (
      await service.save(
        STAFF,
        SETTINGS_VENUE,
        saveBody(store, { hours: hours("17:00"), affectedBookings: "keep" }),
      )
    )._unsafeUnwrap();
    expect(result.cancelled).toBe(0);
    expect(result.affected.map((a) => a.reference)).toEqual(["COL-1001", "COL-1002"]);
    expect(bookings.bookings.every((b) => b.status === "booked")).toBe(true);
    expect(store.hours.every((h) => h.closesLocal === "17:00")).toBe(true);
    expect(events.events[0]?.payload).toMatchObject({
      affectedBookings: 2,
      affectedHandling: "keep",
    });
  });

  it("cancels them, asks the clients to rebook, and records each cancellation with its reason", async () => {
    const { service, store, events, bookings } = withLateBookings();
    const result = (
      await service.save(
        STAFF,
        SETTINGS_VENUE,
        saveBody(store, { hours: hours("17:00"), affectedBookings: "cancel_and_rebook" }),
      )
    )._unsafeUnwrap();
    expect(result.cancelled).toBe(2);
    expect(bookings.bookings.map((b) => [b.reference, b.status])).toEqual([
      ["COL-1001", "cancelled"],
      ["COL-1002", "cancelled"],
      ["COL-1003", "booked"],
    ]);
    const cancellations = events.events.filter(
      (e) => e.eventType === "collection.booking.cancelled",
    );
    expect(cancellations).toHaveLength(2);
    expect(cancellations[0]).toMatchObject({
      aggregateType: "collection_booking",
      actorUserId: "fulfilment-1",
    });
    expect(cancellations[0]?.payload).toMatchObject({
      cancelledVia: "staff",
      reason: "hours_changed",
    });
    expect(events.events.at(0)?.payload).toMatchObject({
      affectedHandling: "cancel_and_rebook",
      affectedBookings: 2,
    });
  });

  it("is not blamed for bookings that were already outside the hours", async () => {
    const { service, store } = setup(
      new InMemorySettingsBookings([
        // A Saturday booking made by staff before the hours changed: already outside the offer.
        visitOn("2001", "2026-11-14T10:00:00Z"),
      ]),
    );
    const result = await service.save(
      STAFF,
      SETTINGS_VENUE,
      saveBody(store, { hours: hours("17:00") }),
    );
    expect(result.isOk()).toBe(true);
  });

  it("counts a smaller number of places at once against the bookings holding the higher ones", async () => {
    const { service, store } = setup(
      new InMemorySettingsBookings([visitOn("3001", "2026-11-12T10:00:00Z", { seat: 2 })]),
    );
    const error = failed(
      await service.save(STAFF, SETTINGS_VENUE, saveBody(store, { placesPerSlot: 1 })),
    );
    expect(error.affected?.[0]).toMatchObject({ reference: "COL-3001", reason: "over_capacity" });
  });

  it("leaves a booking made after the cut-off for the change alone when it cancels the rest", async () => {
    const bookings = new InMemorySettingsBookings([
      friday("1001", "17:30"),
      friday("1002", "18:00"),
    ]);
    const { service, store } = setup(bookings);
    // One of them is cancelled by the client while staff are deciding.
    const stale = bookings.bookings[0];
    if (stale) bookings.bookings[0] = { ...stale, icsSequence: 5 };
    const result = (
      await service.save(
        STAFF,
        SETTINGS_VENUE,
        saveBody(store, { hours: hours("17:00"), affectedBookings: "cancel_and_rebook" }),
      )
    )._unsafeUnwrap();
    expect(result.cancelled).toBe(2);
  });
});

describe("closures and extra openings", () => {
  const closure = (over: Record<string, unknown> = {}) => ({
    kind: "closure" as const,
    startsOn: "2026-12-24",
    endsOn: "2026-12-24",
    opensLocal: null,
    closesLocal: null,
    ...over,
  });

  it("adds a closure with a private note, and records it without the note", async () => {
    const { service, events, store } = setup();
    const result = (
      await service.addException(STAFF, SETTINGS_VENUE, closure({ reason: "Staff party" }))
    )._unsafeUnwrap();
    expect(result.settings.exceptions[0]).toMatchObject({
      kind: "closure",
      startsOn: "2026-12-24",
      source: "staff",
      reason: "Staff party",
      canRemove: true,
    });
    expect(store.stored).toHaveLength(1);
    expect(events.events[0]).toMatchObject({
      eventType: "collection.exception.added",
      actorUserId: "fulfilment-1",
    });
    expect(JSON.stringify(events.events[0]?.payload)).not.toContain("Staff party");
    expect(events.events[0]?.payload).toMatchObject({ partDay: false, affectedBookings: 0 });
  });

  it("adds a closure for part of a day, and an extra opening on a Saturday", async () => {
    const { service } = setup();
    expect(
      (
        await service.addException(
          STAFF,
          SETTINGS_VENUE,
          closure({ opensLocal: "13:00", closesLocal: "14:00" }),
        )
      ).isOk(),
    ).toBe(true);
    expect(
      (
        await service.addException(
          STAFF,
          SETTINGS_VENUE,
          closure({
            kind: "extra_opening",
            startsOn: "2026-12-19",
            endsOn: "2026-12-19",
            opensLocal: "10:00",
            closesLocal: "16:00",
          }),
        )
      ).isOk(),
    ).toBe(true);
  });

  it("opens a sale day anyway with an extra opening that keeps the regular hours", async () => {
    const { service, store } = setup();
    const result = await service.addException(
      STAFF,
      SETTINGS_VENUE,
      closure({ kind: "extra_opening", startsOn: "2026-11-26", endsOn: "2026-11-26" }),
    );
    expect(result.isOk()).toBe(true);
    expect(store.stored[0]).toMatchObject({ kind: "extra_opening", opensLocal: null });
  });

  it("names what is wrong with a closure, and refuses one in the past", async () => {
    const { service, store } = setup();
    expect(
      failed(await service.addException(STAFF, SETTINGS_VENUE, closure({ endsOn: "2026-12-23" }))),
    ).toMatchObject({ code: "exception_invalid", issues: { exception: ["ends_before_start"] } });
    expect(
      failed(await service.addException(STAFF, SETTINGS_VENUE, closure({ opensLocal: "13:00" }))),
    ).toMatchObject({ issues: { exception: ["hours_incomplete"] } });
    expect(
      failed(
        await service.addException(
          STAFF,
          SETTINGS_VENUE,
          closure({ startsOn: "2026-11-01", endsOn: "2026-11-02" }),
        ),
      ).issues?.exception,
    ).toEqual(["date_invalid"]);
    expect(store.stored).toHaveLength(0);
  });

  it("lists the bookings a closure would hit and waits for staff to choose", async () => {
    const { service, store, events } = setup(
      new InMemorySettingsBookings([visitOn("4001", "2026-12-24T11:00:00Z")]),
    );
    const error = failed(await service.addException(STAFF, SETTINGS_VENUE, closure()));
    expect(error).toMatchObject({ code: "bookings_affected" });
    expect(error.affected?.[0]).toMatchObject({ reference: "COL-4001", reason: "closed" });
    expect(store.stored).toHaveLength(0);
    expect(events.events).toHaveLength(0);

    const done = (
      await service.addException(
        STAFF,
        SETTINGS_VENUE,
        closure({ affectedBookings: "cancel_and_rebook" }),
      )
    )._unsafeUnwrap();
    expect(done.cancelled).toBe(1);
    const cancelled = events.events.find((e) => e.eventType === "collection.booking.cancelled");
    expect(cancelled?.payload).toMatchObject({ reason: "closure_added", cancelledVia: "staff" });
  });

  it("does not let an extra opening affect any booking", async () => {
    const { service } = setup(
      new InMemorySettingsBookings([visitOn("4002", "2026-12-24T11:00:00Z")]),
    );
    const result = await service.addException(
      STAFF,
      SETTINGS_VENUE,
      closure({ kind: "extra_opening", opensLocal: "09:00", closesLocal: "10:00" }),
    );
    expect(result.isOk()).toBe(true);
  });

  it("removes a closure, records it, and says when it is not there", async () => {
    const { service, store, events } = setup();
    const added = (await service.addException(STAFF, SETTINGS_VENUE, closure()))._unsafeUnwrap();
    const id = added.settings.exceptions[0]?.id as string;
    const removed = (await service.removeException(STAFF, SETTINGS_VENUE, id, {}))._unsafeUnwrap();
    expect(removed.settings.exceptions).toEqual([]);
    expect(store.stored).toHaveLength(0);
    expect(events.events.at(-1)?.eventType).toBe("collection.exception.removed");
    expect(failed(await service.removeException(STAFF, SETTINGS_VENUE, id, {})).code).toBe(
      "exception_not_found",
    );
  });

  it("can remove a bank holiday, and cannot reach a sale day", async () => {
    const { service, store } = setup();
    store.stored.push({
      id: "d0000000-0000-4000-8000-0000000000b1",
      kind: "closure",
      startsOn: "2026-12-25",
      endsOn: "2026-12-25",
      opensLocal: null,
      closesLocal: null,
      source: "bank_holiday",
      reasonInternal: null,
      saleId: null,
      saleTitle: null,
      createdByUserId: null,
      createdAt: null,
    });
    expect(
      (
        await service.removeException(
          STAFF,
          SETTINGS_VENUE,
          "d0000000-0000-4000-8000-0000000000b1",
          {},
        )
      ).isOk(),
    ).toBe(true);
    expect(
      failed(await service.removeException(STAFF, SETTINGS_VENUE, "not-a-stored-id", {})).code,
    ).toBe("exception_not_found");
  });

  it("asks before removing an extra opening that bookings rely on", async () => {
    const { service, store } = setup(
      new InMemorySettingsBookings([visitOn("5001", "2026-12-19T10:00:00Z")]),
    );
    store.stored.push({
      id: "d0000000-0000-4000-8000-0000000000b2",
      kind: "extra_opening",
      startsOn: "2026-12-19",
      endsOn: "2026-12-19",
      opensLocal: "10:00",
      closesLocal: "16:00",
      source: "staff",
      reasonInternal: null,
      saleId: null,
      saleTitle: null,
      createdByUserId: null,
      createdAt: null,
    });
    const error = failed(
      await service.removeException(
        STAFF,
        SETTINGS_VENUE,
        "d0000000-0000-4000-8000-0000000000b2",
        {},
      ),
    );
    expect(error).toMatchObject({ code: "bookings_affected" });
    expect(error.affected?.[0]?.reference).toBe("COL-5001");
  });
});
