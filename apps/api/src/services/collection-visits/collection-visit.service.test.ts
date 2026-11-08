import type { LegalEntityMemberRole } from "@auction/types";
import type { BookCollectionBody } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  COLLECTION_ACCOUNT,
  COLLECTION_LOTS,
  COLLECTION_NOW,
  InMemoryCollectionBookings,
  InMemoryCollectionLotFacts,
  InMemoryCollectionPlaces,
  OTHER_COLLECTION_ACCOUNT,
  RecordingEvents,
  collectionLot,
} from "../../testing/in-memory-collection-visits.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { CollectionLotGuard } from "./collection-lot-guard.js";
import { CollectionVisitService } from "./collection-visit.service.js";

const TUESDAY_10 = "2026-11-10T10:00:00.000Z";
const TUESDAY_1030 = "2026-11-10T10:30:00.000Z";
const WEDNESDAY_10 = "2026-11-11T10:00:00.000Z";
const SATURDAY_10 = "2026-11-14T10:00:00.000Z";
const MONDAY_14 = "2026-11-09T14:00:00.000Z";

function setup() {
  const clock = { now: COLLECTION_NOW };
  const facts = new InMemoryCollectionLotFacts();
  const places = new InMemoryCollectionPlaces();
  const bookings = new InMemoryCollectionBookings();
  const events = new RecordingEvents();
  const service = new CollectionVisitService({
    lots: new CollectionLotGuard(facts),
    facts,
    places,
    bookings,
    events,
    now: () => clock.now,
  });
  return { service, facts, places, bookings, events, clock };
}

const actor = (
  role: LegalEntityMemberRole = "owner",
  over: Partial<OrganisationMemberActor> = {},
): OrganisationMemberActor => ({
  userId: `${role}-1`,
  legalEntityId: COLLECTION_ACCOUNT,
  role,
  ...over,
});

let keyCounter = 0;
const body = (over: Partial<BookCollectionBody> = {}): BookCollectionBody => {
  keyCounter += 1;
  return {
    lotIds: [COLLECTION_LOTS.one],
    slotStart: TUESDAY_10,
    collector: { kind: "self", name: "Maya Okafor" },
    idempotencyKey: `key-${String(keyCounter).padStart(8, "0")}`,
    ...over,
  };
};

const failed = <T>(result: { isErr(): boolean; error?: unknown; _unsafeUnwrapErr(): T }) =>
  result._unsafeUnwrapErr();

async function booked(s: ReturnType<typeof setup>, over: Partial<BookCollectionBody> = {}) {
  const result = await s.service.book(actor(), body(over));
  return result._unsafeUnwrap().visit;
}

describe("availability", () => {
  it("lists the next four weeks from today, with the first bookable time", async () => {
    const s = setup();
    const result = (
      await s.service.availability(actor(), { lots: [COLLECTION_LOTS.one] })
    )._unsafeUnwrap();
    expect(result.days).toHaveLength(28);
    expect(result.days[0]).toMatchObject({ date: "2026-11-09", state: "too_soon", openSlots: 0 });
    expect(result.days[1]).toMatchObject({ date: "2026-11-10", state: "open", openSlots: 18 });
    expect(result.earliest).toBe(TUESDAY_10);
    expect(result).toMatchObject({
      onlineBookingEnabled: true,
      visitMinutes: 30,
      timeZone: "Europe/London",
      noticeCutoffLocal: "16:00",
    });
    expect(result.days[5]).toMatchObject({ date: "2026-11-14", state: "closed", slots: [] });
  });

  it("says which lots can be ticked and why not, and still shows the times", async () => {
    const s = setup();
    const result = (
      await s.service.availability(actor(), {
        lots: [COLLECTION_LOTS.one, COLLECTION_LOTS.unpaid],
      })
    )._unsafeUnwrap();
    expect(result.lots.map((l) => [l.lotId, l.collectable, l.blockedReason])).toEqual([
      [COLLECTION_LOTS.one, true, null],
      [COLLECTION_LOTS.unpaid, false, "payment_not_cleared"],
    ]);
    expect(result.lots[1]?.blockedMessage).toMatch(/payment has cleared/);
    expect(result.days.length).toBe(28);
  });

  it("counts places already taken, and the booking being moved does not count against its own time", async () => {
    const s = setup();
    const a = await booked(s, { lotIds: [COLLECTION_LOTS.one] });
    await booked(s, { lotIds: [COLLECTION_LOTS.two] });
    const full = (
      await s.service.availability(actor(), { lots: [COLLECTION_LOTS.three] })
    )._unsafeUnwrap();
    expect(full.days[1]?.slots[0]).toMatchObject({
      start: TUESDAY_10,
      placesLeft: 0,
      state: "full",
    });
    const moving = (
      await s.service.availability(actor(), { lots: [COLLECTION_LOTS.one], booking: a.id })
    )._unsafeUnwrap();
    expect(moving.days[1]?.slots[0]).toMatchObject({ placesLeft: 1, state: "open" });
    // ...and the lot it holds is not "already booked" while it is being moved.
    expect(moving.lots[0]?.collectable).toBe(true);
  });

  it("falls back to email while online booking is off, with no times", async () => {
    const s = setup();
    s.places.settings = { ...s.places.settings, onlineBookingEnabled: false };
    const result = (
      await s.service.availability(actor(), { lots: [COLLECTION_LOTS.one] })
    )._unsafeUnwrap();
    expect(result).toMatchObject({
      onlineBookingEnabled: false,
      bookingEmail: "collections@lax.example",
      days: [],
      earliest: null,
    });
  });

  it("answers not found for another account's lot, or one that does not exist", async () => {
    const s = setup();
    for (const lot of [COLLECTION_LOTS.otherAccount, "c0000000-0000-4000-8000-0000000000ff"]) {
      const error = failed(await s.service.availability(actor(), { lots: [lot] }));
      expect(error).toMatchObject({ code: "lot_not_found", status: 404 });
    }
  });

  it("refuses lots from different places, and no lots", async () => {
    const s = setup();
    const mixed = failed(
      await s.service.availability(actor(), {
        lots: [COLLECTION_LOTS.one, COLLECTION_LOTS.otherPlace],
      }),
    );
    expect(mixed).toMatchObject({ code: "mixed_places", status: 422 });
    expect(failed(await s.service.availability(actor(), { lots: [] }))).toMatchObject({
      code: "no_lots",
      status: 400,
    });
  });

  it("is open to a platform admin viewing as the account, which only reads", async () => {
    const s = setup();
    const result = await s.service.availability(actor("owner", { isImpersonation: true }), {
      lots: [COLLECTION_LOTS.one],
    });
    expect(result.isOk()).toBe(true);
  });
});

describe("who may book which lot", () => {
  it.each(["owner", "admin", "finance"] as const)("lets %s book any paid lot", async (role) => {
    const s = setup();
    const result = await s.service.book(actor(role), body({ lotIds: [COLLECTION_LOTS.agentWin] }));
    expect(result.isOk()).toBe(true);
  });

  it("lets a buyer agent book the lot they won, and not one they did not", async () => {
    const s = setup();
    const own = await s.service.book(
      actor("buyer_agent"),
      body({ lotIds: [COLLECTION_LOTS.agentWin] }),
    );
    expect(own.isOk()).toBe(true);
    const other = failed(
      await s.service.book(actor("buyer_agent"), body({ lotIds: [COLLECTION_LOTS.one] })),
    );
    expect(other).toMatchObject({
      code: "lot_not_yours_to_book",
      status: 403,
      lotId: COLLECTION_LOTS.one,
    });
    expect(s.bookings.bookings).toHaveLength(1);
  });

  it.each(["consignor", "viewer"] as const)("does not let a %s book", async (role) => {
    const s = setup();
    const error = failed(await s.service.book(actor(role), body()));
    expect(error.status).toBe(403);
    expect(s.bookings.bookings).toHaveLength(0);
  });

  it("lets a person book the lots they won on their own account, and no one else's", async () => {
    const s = setup();
    s.facts.records.push(
      collectionLot("c0000000-0000-4000-8000-0000000000b1", {
        buyerAccountKind: "individual",
        winnerId: "owner-1",
        facts: { organisationStatus: null },
      }),
      collectionLot("c0000000-0000-4000-8000-0000000000b2", {
        buyerAccountKind: "individual",
        winnerId: "someone-else",
        facts: { organisationStatus: null },
      }),
    );
    const mine = await s.service.book(
      actor(),
      body({ lotIds: ["c0000000-0000-4000-8000-0000000000b1"] }),
    );
    expect(mine.isOk()).toBe(true);
    const theirs = failed(
      await s.service.book(actor(), body({ lotIds: ["c0000000-0000-4000-8000-0000000000b2"] })),
    );
    expect(theirs).toMatchObject({ code: "lot_not_yours_to_book" });
  });

  it("never confirms another account's lot exists, whoever asks", async () => {
    const s = setup();
    const error = failed(
      await s.service.book(actor(), body({ lotIds: [COLLECTION_LOTS.otherAccount] })),
    );
    expect(error).toMatchObject({ code: "lot_not_found", status: 404 });
    expect(s.bookings.bookings).toHaveLength(0);
  });

  it("refuses a booking made while viewing as the account, and stores nothing", async () => {
    const s = setup();
    const error = failed(await s.service.book(actor("owner", { isImpersonation: true }), body()));
    expect(error).toMatchObject({ code: "read_only", status: 403 });
    expect(s.bookings.bookings).toHaveLength(0);
    expect(s.events.events).toHaveLength(0);
  });
});

describe("book", () => {
  it("books the first open time and records who, what and when", async () => {
    const s = setup();
    const result = (await s.service.book(actor(), body()))._unsafeUnwrap();
    expect(result.replayed).toBe(false);
    expect(result.visit).toMatchObject({
      status: "booked",
      start: TUESDAY_10,
      end: TUESDAY_1030,
      version: 0,
      bookedByYou: true,
      bookedVia: "client",
      collector: { kind: "self", name: "Maya Okafor" },
      // The last moment to change it online: 16:00 on the working day before.
      noticeDeadline: "2026-11-09T16:00:00.000Z",
      actions: ["change", "cancel"],
    });
    expect(result.visit.lots).toEqual([
      { lotId: COLLECTION_LOTS.one, title: "Lot 1", lotNumber: 1, active: true, outcome: null },
    ]);
    const stored = s.bookings.bookings[0];
    expect(stored).toMatchObject({
      legalEntityId: COLLECTION_ACCOUNT,
      bookedByUserId: "owner-1",
      collector: { userId: "owner-1" },
    });
  });

  it("records the booking in the audit log in the same step, without the collector's details", async () => {
    const s = setup();
    await s.service.book(
      actor(),
      body({
        collector: {
          kind: "third_party",
          name: "Sam Okoro",
          email: "sam@example.com",
          company: "Okoro Shipping",
          authorised: true,
        },
      }),
    );
    expect(s.events.events).toHaveLength(1);
    const event = s.events.events[0];
    expect(event).toMatchObject({
      aggregateType: "collection_booking",
      eventType: "collection.booking.created",
      actorUserId: "owner-1",
      actingLegalEntityId: COLLECTION_ACCOUNT,
    });
    expect(event?.payload).toMatchObject({
      lotIds: [COLLECTION_LOTS.one],
      collectorKind: "third_party",
      authorised: true,
      bookedVia: "client",
    });
    const text = JSON.stringify(event?.payload);
    for (const secret of ["Sam Okoro", "sam@example.com", "Okoro Shipping"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("keeps no booking when its audit record cannot be written", async () => {
    const s = setup();
    s.bookings.failWithin = new Error("audit unavailable");
    await expect(s.service.book(actor(), body())).rejects.toThrow("audit unavailable");
    expect(s.bookings.bookings).toHaveLength(0);
  });

  it("stores a third party with the account holder's authorisation, the time and the policy", async () => {
    const s = setup();
    await s.service.book(
      actor(),
      body({
        collector: { kind: "third_party", name: "Sam Okoro", authorised: true },
      }),
    );
    expect(s.bookings.bookings[0]).toMatchObject({
      authorisedByUserId: "owner-1",
      authorisedAt: COLLECTION_NOW,
      policyVersion: "2026-11",
      collector: { kind: "third_party", userId: null },
    });
  });

  it("refuses a third party who was not authorised, and says which field", async () => {
    const s = setup();
    const error = failed(
      await s.service.book(
        actor(),
        body({ collector: { kind: "third_party", name: "Sam Okoro", email: "nope" } }),
      ),
    );
    expect(error).toMatchObject({ code: "collector_invalid", status: 422 });
    expect(error.issues).toEqual([
      { field: "email", code: "email_invalid" },
      { field: "authorisation", code: "authorisation_required" },
    ]);
    expect(s.bookings.bookings).toHaveLength(0);
  });

  it("names the first lot that cannot be collected, and why", async () => {
    const s = setup();
    const error = failed(
      await s.service.book(
        actor(),
        body({ lotIds: [COLLECTION_LOTS.one, COLLECTION_LOTS.unpaid] }),
      ),
    );
    expect(error).toMatchObject({
      code: "lot_not_collectable",
      status: 422,
      lotId: COLLECTION_LOTS.unpaid,
      reason: "payment_not_cleared",
    });
  });

  it("refuses a time the place does not offer, one too soon, and one that is full", async () => {
    const s = setup();
    expect(failed(await s.service.book(actor(), body({ slotStart: SATURDAY_10 })))).toMatchObject({
      code: "slot_unknown",
      status: 422,
    });
    expect(failed(await s.service.book(actor(), body({ slotStart: MONDAY_14 })))).toMatchObject({
      code: "notice_passed",
      status: 422,
    });
    await booked(s, { lotIds: [COLLECTION_LOTS.one] });
    await booked(s, { lotIds: [COLLECTION_LOTS.two] });
    expect(
      failed(await s.service.book(actor(), body({ lotIds: [COLLECTION_LOTS.three] }))),
    ).toMatchObject({ code: "slot_full", status: 409 });
  });

  it("stays on the cut-off: Tuesday is open at 16:00 on Monday and gone a moment later", async () => {
    const s = setup();
    s.clock.now = new Date("2026-11-09T16:00:00.000Z");
    expect((await s.service.book(actor(), body())).isOk()).toBe(true);
    s.clock.now = new Date("2026-11-09T16:00:00.001Z");
    expect(
      failed(await s.service.book(actor(), body({ lotIds: [COLLECTION_LOTS.two] }))),
    ).toMatchObject({ code: "notice_passed" });
  });

  it("answers with the email route while online booking is off", async () => {
    const s = setup();
    s.places.settings = { ...s.places.settings, onlineBookingEnabled: false };
    const error = failed(await s.service.book(actor(), body()));
    expect(error).toMatchObject({
      code: "online_booking_off",
      status: 409,
      bookingEmail: "collections@lax.example",
    });
  });

  it("turns a lost race for a lot into a lot that cannot be booked", async () => {
    const s = setup();
    await booked(s, { lotIds: [COLLECTION_LOTS.one] });
    const error = failed(
      await s.service.book(
        actor(),
        body({ slotStart: WEDNESDAY_10, lotIds: [COLLECTION_LOTS.one] }),
      ),
    );
    expect(error).toMatchObject({
      code: "lot_not_collectable",
      lotId: COLLECTION_LOTS.one,
      reason: "already_booked",
    });
  });
});

describe("a booking attempt sent twice", () => {
  it("returns the same booking, marked as a replay, and records nothing twice", async () => {
    const s = setup();
    const request = body();
    const first = (await s.service.book(actor(), request))._unsafeUnwrap();
    const again = (await s.service.book(actor(), { ...request }))._unsafeUnwrap();
    expect(again.replayed).toBe(true);
    expect(again.visit.id).toBe(first.visit.id);
    expect(s.bookings.bookings).toHaveLength(1);
    expect(s.events.events).toHaveLength(1);
  });

  it("still gets its booking back when the time has since filled up and its lots are booked", async () => {
    const s = setup();
    const request = body();
    const first = (await s.service.book(actor(), request))._unsafeUnwrap();
    await booked(s, { lotIds: [COLLECTION_LOTS.two] });
    const again = (await s.service.book(actor(), { ...request }))._unsafeUnwrap();
    expect(again).toMatchObject({ replayed: true, visit: { id: first.visit.id } });
  });

  it("still gets its booking back after the cut-off for that time has passed", async () => {
    const s = setup();
    const request = body();
    const first = (await s.service.book(actor(), request))._unsafeUnwrap();
    s.clock.now = new Date("2026-11-09T17:00:00.000Z");
    const again = (await s.service.book(actor(), { ...request }))._unsafeUnwrap();
    expect(again.visit.id).toBe(first.visit.id);
    expect(again.visit.actions).toEqual([]);
  });

  it("refuses the same key used for a different request with 409 idempotency_key_reused", async () => {
    const s = setup();
    const request = body();
    await s.service.book(actor(), request);
    for (const change of [
      { slotStart: WEDNESDAY_10 },
      { lotIds: [COLLECTION_LOTS.two] },
      { collector: { kind: "self" as const, name: "Someone Else" } },
    ]) {
      const error = failed(await s.service.book(actor(), { ...request, ...change }));
      expect(error).toMatchObject({ code: "idempotency_key_reused", status: 409 });
    }
    expect(s.bookings.bookings).toHaveLength(1);
  });

  it("does not let one account's key answer another's", async () => {
    const s = setup();
    const request = body();
    await s.service.book(actor(), request);
    s.facts.records.push(
      collectionLot("c0000000-0000-4000-8000-0000000000c1", {
        buyerLegalEntityId: OTHER_COLLECTION_ACCOUNT,
      }),
    );
    const other = await s.service.book(
      { ...actor(), legalEntityId: OTHER_COLLECTION_ACCOUNT },
      { ...request, lotIds: ["c0000000-0000-4000-8000-0000000000c1"] },
    );
    expect(other._unsafeUnwrap().replayed).toBe(false);
  });
});

describe("change", () => {
  const change = (
    version: number,
    over: Partial<{
      lotIds: string[];
      slotStart: string;
      collector: BookCollectionBody["collector"];
    }> = {},
  ) => ({
    version,
    lotIds: [COLLECTION_LOTS.one],
    slotStart: TUESDAY_10,
    collector: { kind: "self" as const, name: "Maya Okafor" },
    ...over,
  });

  it("moves the visit, raises the version, frees the old place and records the move", async () => {
    const s = setup();
    const visit = await booked(s);
    const moved = (
      await s.service.change(actor(), visit.id, change(visit.version, { slotStart: WEDNESDAY_10 }))
    )._unsafeUnwrap();
    expect(moved).toMatchObject({ id: visit.id, start: WEDNESDAY_10, version: 1 });
    const events = s.events.events.map((e) => e.eventType);
    expect(events).toEqual(["collection.booking.created", "collection.booking.changed"]);
    expect(s.events.events[1]?.payload).toMatchObject({
      previousSlotStart: TUESDAY_10,
      slotStart: WEDNESDAY_10,
      icsSequence: 1,
    });
    // The place it left is free again.
    expect((await s.service.book(actor(), body({ lotIds: [COLLECTION_LOTS.two] }))).isOk()).toBe(
      true,
    );
  });

  it("lets the collector change without moving, even in a time that is otherwise full", async () => {
    const s = setup();
    const visit = await booked(s, { lotIds: [COLLECTION_LOTS.one] });
    await booked(s, { lotIds: [COLLECTION_LOTS.two] });
    const result = await s.service.change(
      actor(),
      visit.id,
      change(visit.version, { collector: { kind: "self", name: "Maya A. Okafor" } }),
    );
    expect(result._unsafeUnwrap().collector.name).toBe("Maya A. Okafor");
  });

  it("keeps the old time when the new one is full", async () => {
    const s = setup();
    await booked(s, { slotStart: WEDNESDAY_10, lotIds: [COLLECTION_LOTS.two] });
    await booked(s, { slotStart: WEDNESDAY_10, lotIds: [COLLECTION_LOTS.three] });
    const visit = await booked(s, { lotIds: [COLLECTION_LOTS.one] });
    const error = failed(
      await s.service.change(actor(), visit.id, change(visit.version, { slotStart: WEDNESDAY_10 })),
    );
    expect(error).toMatchObject({ code: "slot_full", status: 409 });
    expect((await s.bookings.findById(visit.id))?.slotStart.toISOString()).toBe(TUESDAY_10);
  });

  it("is refused after the cut-off, to the moment", async () => {
    const s = setup();
    const visit = await booked(s);
    const rename = (version: number, name: string) =>
      change(version, { collector: { kind: "self", name } });
    s.clock.now = new Date("2026-11-09T16:00:00.000Z");
    expect(
      (await s.service.change(actor(), visit.id, rename(visit.version, "Maya A. Okafor"))).isOk(),
    ).toBe(true);
    s.clock.now = new Date("2026-11-09T16:00:00.001Z");
    const error = failed(await s.service.change(actor(), visit.id, rename(1, "Maya B. Okafor")));
    expect(error).toMatchObject({ code: "cutoff_passed", status: 409 });
    expect((await s.bookings.findById(visit.id))?.collector.name).toBe("Maya A. Okafor");
  });

  it("is refused on a copy that is out of date", async () => {
    const s = setup();
    const visit = await booked(s);
    await s.service.change(actor(), visit.id, change(0, { slotStart: WEDNESDAY_10 }));
    const error = failed(
      await s.service.change(actor(), visit.id, change(0, { slotStart: TUESDAY_10 })),
    );
    expect(error).toMatchObject({ code: "booking_changed", status: 409 });
  });

  it("answers not found for a booking that is not the account's", async () => {
    const s = setup();
    const visit = await booked(s);
    const error = failed(
      await s.service.change(
        { ...actor(), legalEntityId: OTHER_COLLECTION_ACCOUNT },
        visit.id,
        change(visit.version),
      ),
    );
    expect(error).toMatchObject({ code: "booking_not_found", status: 404 });
  });

  it("is refused to a buyer agent for lots they did not win", async () => {
    const s = setup();
    const visit = await booked(s);
    const error = failed(
      await s.service.change(actor("buyer_agent"), visit.id, change(visit.version)),
    );
    expect(error).toMatchObject({ code: "lot_not_yours_to_book", status: 403 });
  });

  it("refuses a lot that cannot be collected, and one from another place", async () => {
    const s = setup();
    const visit = await booked(s);
    const unpaid = failed(
      await s.service.change(
        actor(),
        visit.id,
        change(visit.version, { lotIds: [COLLECTION_LOTS.one, COLLECTION_LOTS.unpaid] }),
      ),
    );
    expect(unpaid).toMatchObject({ code: "lot_not_collectable", reason: "payment_not_cleared" });
    const elsewhere = failed(
      await s.service.change(
        actor(),
        visit.id,
        change(visit.version, { lotIds: [COLLECTION_LOTS.otherPlace] }),
      ),
    );
    expect(elsewhere.code).toBe("mixed_places");
  });

  it("is refused once the visit is cancelled, and while viewing as the account", async () => {
    const s = setup();
    const visit = await booked(s);
    const impersonating = failed(
      await s.service.change(
        actor("owner", { isImpersonation: true }),
        visit.id,
        change(visit.version),
      ),
    );
    expect(impersonating.code).toBe("read_only");
    await s.service.cancel(actor(), visit.id, { version: visit.version });
    const closed = failed(await s.service.change(actor(), visit.id, change(1)));
    expect(closed).toMatchObject({ code: "booking_closed", status: 409 });
  });
});

describe("cancel", () => {
  it("cancels, frees the place and lots, and records it as the client's", async () => {
    const s = setup();
    const visit = await booked(s);
    const cancelled = (
      await s.service.cancel(actor(), visit.id, { version: visit.version })
    )._unsafeUnwrap();
    expect(cancelled).toMatchObject({ status: "cancelled", version: 1, actions: [] });
    expect(cancelled.cancelledAt).toBe(COLLECTION_NOW.toISOString());
    expect(s.events.events.at(-1)).toMatchObject({
      eventType: "collection.booking.cancelled",
      actorUserId: "owner-1",
    });
    expect(s.events.events.at(-1)?.payload).toMatchObject({ cancelledVia: "client" });
    expect(s.events.events.at(-1)?.payload).not.toHaveProperty("reason");
    // The lot can be booked again.
    expect((await s.service.book(actor(), body())).isOk()).toBe(true);
  });

  it("is refused after the cut-off, with the gallery to contact instead", async () => {
    const s = setup();
    const visit = await booked(s);
    s.clock.now = new Date("2026-11-09T16:00:01.000Z");
    const error = failed(await s.service.cancel(actor(), visit.id, { version: visit.version }));
    expect(error).toMatchObject({ code: "cutoff_passed", status: 409 });
    expect((await s.bookings.findById(visit.id))?.status).toBe("booked");
  });

  it("is refused on a stale copy, to a stranger, and while viewing as the account", async () => {
    const s = setup();
    const visit = await booked(s);
    expect(failed(await s.service.cancel(actor(), visit.id, { version: 5 })).code).toBe(
      "booking_changed",
    );
    expect(
      failed(
        await s.service.cancel({ ...actor(), legalEntityId: OTHER_COLLECTION_ACCOUNT }, visit.id, {
          version: 0,
        }),
      ).code,
    ).toBe("booking_not_found");
    expect(
      failed(
        await s.service.cancel(actor("owner", { isImpersonation: true }), visit.id, { version: 0 }),
      ).code,
    ).toBe("read_only");
    expect((await s.bookings.findById(visit.id))?.status).toBe("booked");
  });

  it("is refused to a buyer agent for a booking of lots they did not win", async () => {
    const s = setup();
    const visit = await booked(s);
    const error = failed(await s.service.cancel(actor("buyer_agent"), visit.id, { version: 0 }));
    expect(error.code).toBe("lot_not_yours_to_book");
  });

  it("cannot be done twice", async () => {
    const s = setup();
    const visit = await booked(s);
    await s.service.cancel(actor(), visit.id, { version: 0 });
    expect(failed(await s.service.cancel(actor(), visit.id, { version: 1 })).code).toBe(
      "booking_closed",
    );
  });
});

describe("my visits", () => {
  it("lists the account's visits with what the member can still do", async () => {
    const s = setup();
    await booked(s);
    const [visit] = (await s.service.list(actor()))._unsafeUnwrap();
    expect(visit).toMatchObject({
      status: "booked",
      noticeDeadline: "2026-11-09T16:00:00.000Z",
      actions: ["change", "cancel"],
      bookedByYou: true,
    });
  });

  it("takes the buttons away once the cut-off has passed, and keeps the visit", async () => {
    const s = setup();
    await booked(s);
    s.clock.now = new Date("2026-11-09T17:00:00.000Z");
    const [visit] = (await s.service.list(actor()))._unsafeUnwrap();
    expect(visit?.actions).toEqual([]);
    expect(visit?.status).toBe("booked");
  });

  it("shows a platform admin viewing as the account the visits with no actions", async () => {
    const s = setup();
    await booked(s);
    const [visit] = (
      await s.service.list(actor("owner", { isImpersonation: true }))
    )._unsafeUnwrap();
    expect(visit?.actions).toEqual([]);
  });

  it("shows a buyer agent the visits they made or that hold only lots they won", async () => {
    const s = setup();
    await booked(s, { lotIds: [COLLECTION_LOTS.one] });
    await s.service.book(
      actor("buyer_agent"),
      body({ lotIds: [COLLECTION_LOTS.agentWin], slotStart: WEDNESDAY_10 }),
    );
    expect((await s.service.list(actor()))._unsafeUnwrap()).toHaveLength(2);
    const seen = (await s.service.list(actor("buyer_agent")))._unsafeUnwrap();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.lots[0]?.lotId).toBe(COLLECTION_LOTS.agentWin);
  });

  it("marks a visit another member booked as not yours, without saying who", async () => {
    const s = setup();
    await booked(s);
    const [visit] = (await s.service.list(actor("admin")))._unsafeUnwrap();
    expect(visit?.bookedByYou).toBe(false);
    expect(JSON.stringify(visit)).not.toContain("owner-1");
  });

  it("is refused to a member who does not follow purchases", async () => {
    const s = setup();
    expect(failed(await s.service.list(actor("viewer"))).status).toBe(403);
    expect(failed(await s.service.list(actor("consignor"))).status).toBe(403);
  });

  it("does not list another account's visits", async () => {
    const s = setup();
    await booked(s);
    const other = (
      await s.service.list({ ...actor(), legalEntityId: OTHER_COLLECTION_ACCOUNT })
    )._unsafeUnwrap();
    expect(other).toEqual([]);
  });
});

describe("calendar", () => {
  it("gives a calendar file for a live visit, with the reference and the place and no prices", async () => {
    const s = setup();
    const visit = await booked(s);
    const file = (await s.service.calendar(actor(), visit.id))._unsafeUnwrap();
    expect(file.filename).toBe(`collection-${visit.reference}.ics`);
    expect(file.content).toContain("METHOD:PUBLISH");
    expect(file.content).toContain(`UID:${visit.reference}@lax.bid`);
    expect(file.content).toContain("LOCATION:156 New Cavendish Street\\, London\\, W1W 6YW");
    expect(file.content).not.toMatch(/£|price/i);
  });

  it("is not given for a cancelled visit, or to another account", async () => {
    const s = setup();
    const visit = await booked(s);
    expect(
      failed(
        await s.service.calendar({ ...actor(), legalEntityId: OTHER_COLLECTION_ACCOUNT }, visit.id),
      ).code,
    ).toBe("booking_not_found");
    await s.service.cancel(actor(), visit.id, { version: 0 });
    expect(failed(await s.service.calendar(actor(), visit.id)).code).toBe("booking_closed");
  });

  it("can be read by a platform admin viewing as the account", async () => {
    const s = setup();
    const visit = await booked(s);
    expect(
      (await s.service.calendar(actor("owner", { isImpersonation: true }), visit.id)).isOk(),
    ).toBe(true);
  });
});
