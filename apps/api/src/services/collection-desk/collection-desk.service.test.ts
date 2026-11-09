import type { CollectionDeskLot } from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import {
  COLLECTION_ACCOUNT,
  COLLECTION_LOTS,
  COLLECTION_NOW,
  InMemoryCollectionBookings,
  InMemoryCollectionLotFacts,
  InMemoryCollectionPlaces,
  OTHER_COLLECTION_ACCOUNT,
  RecordingEvents,
} from "../../testing/in-memory-collection-visits.js";
import { CollectionDeskService } from "./collection-desk.service.js";

const STAFF = { userId: "staff-1" };
const VENUE = "c0000000-0000-4000-8000-0000000000aa";
const TUESDAY_10 = "2026-11-10T10:00:00.000Z";
const TUESDAY_1030 = "2026-11-10T10:30:00.000Z";
const WEDNESDAY_10 = "2026-11-11T10:00:00.000Z";
const SATURDAY_10 = "2026-11-14T10:00:00.000Z";
const LOTS = [COLLECTION_LOTS.one, COLLECTION_LOTS.two, COLLECTION_LOTS.three] as const;

function setup(statuses: Record<string, string> = {}) {
  const clock = { now: COLLECTION_NOW };
  const facts = new InMemoryCollectionLotFacts();
  const places = new InMemoryCollectionPlaces();
  const bookings = new InMemoryCollectionBookings();
  const events = new RecordingEvents();
  const status = (lotId: string) => statuses[lotId] ?? "released";
  const handedOver: string[] = [];
  const undone: string[] = [];
  const fulfilment = {
    handOverForCollection: vi.fn(async (input: { lotId: string }) => {
      if (status(input.lotId) === "fail") return err({ message: "no", status: 400 });
      handedOver.push(input.lotId);
      return ok({} as never);
    }),
    undoCollectionHandOver: vi.fn(async (input: { lotId: string }) => {
      undone.push(input.lotId);
      return ok({} as never);
    }),
  };
  const desk = {
    lots: async (ids: readonly string[]) =>
      new Map<string, CollectionDeskLot>(
        ids.map((lotId) => [
          lotId,
          {
            lotId,
            title: `Lot ${lotId.slice(-1)}`,
            lotNumber: Number(lotId.slice(-1)),
            image: null,
            fulfilmentStatus: status(lotId) === "fail" ? "released" : status(lotId),
          },
        ]),
      ),
    accountNames: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, "Hayes Collection"])),
  };
  const service = new CollectionDeskService({
    places,
    bookings,
    desk,
    facts,
    fulfilment,
    events,
    now: () => clock.now,
  });
  return { service, clock, facts, places, bookings, events, fulfilment, handedOver, undone };
}

async function booking(
  s: ReturnType<typeof setup>,
  over: { lotIds?: string[]; slotStart?: string; key?: string; thirdParty?: boolean } = {},
) {
  const slotStart = new Date(over.slotStart ?? TUESDAY_10);
  const result = await s.bookings.book({
    legalEntityId: COLLECTION_ACCOUNT,
    venueId: VENUE,
    slotStart,
    slotEnd: new Date(slotStart.getTime() + 30 * 60_000),
    placesPerSlot: 2,
    overCapacityReason: null,
    lotIds: over.lotIds ?? [LOTS[0], LOTS[1]],
    collector: {
      kind: over.thirdParty ? "third_party" : "self",
      name: "Charlotte Hayes",
      email: null,
      company: null,
      userId: null,
      authorisedByUserId: null,
      authorisedAt: null,
      policyVersion: null,
    },
    bookedByUserId: "owner-1",
    bookedVia: "client",
    idempotencyKey: over.key ?? `key-${Math.random().toString(36).slice(2, 12)}`,
  });
  if (result.outcome !== "booked") throw new Error(`could not book: ${result.outcome}`);
  return result.booking;
}

const idCheck = { confirmed: true as const, type: "passport" as const };

describe("handing over", () => {
  it("hands over every lot, records who and the ID type, moves each lot's fulfilment and audits it", async () => {
    const s = setup();
    const b = await booking(s);
    const result = await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[0], LOTS[1]], idCheck });
    const view = result._unsafeUnwrap();
    expect(view.status).toBe("collected");
    expect(view.idCheckType).toBe("passport");
    expect(s.handedOver).toEqual([LOTS[0], LOTS[1]]);
    expect(s.fulfilment.handOverForCollection).toHaveBeenCalledWith({
      lotId: LOTS[0],
      actorUserId: "staff-1",
      collectedBy: "Charlotte Hayes",
    });
    const event = s.events.events.at(-1);
    expect(event).toMatchObject({
      eventType: "collection.booking.handed_over",
      actorUserId: "staff-1",
      payload: { idCheckType: "passport", status: "collected" },
    });
    // Never the number, never a name: the payload holds codes and ids.
    expect(JSON.stringify(event?.payload)).not.toContain("Charlotte");
  });

  it("hands over some lots, leaving the rest to collect", async () => {
    const s = setup();
    const b = await booking(s);
    const view = (
      await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[0]], idCheck })
    )._unsafeUnwrap();
    expect(view.status).toBe("partly_collected");
    expect(view.lots.find((l) => l.lotId === LOTS[1])?.outcome).toBe("left");
    expect(s.handedOver).toEqual([LOTS[0]]);
  });

  it("works from a lot marked ready for collection as well as a released one", async () => {
    const s = setup({ [LOTS[1]]: "ready_for_collection" });
    const b = await booking(s);
    expect(
      (await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[0], LOTS[1]], idCheck })).isOk(),
    ).toBe(true);
  });

  it("is refused until every ticked lot is released, and records nothing", async () => {
    const s = setup({ [LOTS[1]]: "awaiting_release" });
    const b = await booking(s);
    const error = (
      await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[0], LOTS[1]], idCheck })
    )._unsafeUnwrapErr();
    expect(error).toMatchObject({ code: "not_released", status: 409, lotIds: [LOTS[1]] });
    expect(s.events.events.some((e) => e.eventType === "collection.booking.handed_over")).toBe(
      false,
    );
    expect((await s.bookings.findById(b.id))?.status).toBe("booked");
  });

  it("lets staff leave an unreleased lot behind and hand over the released one", async () => {
    const s = setup({ [LOTS[1]]: "awaiting_release" });
    const b = await booking(s);
    const view = (
      await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[0]], idCheck })
    )._unsafeUnwrap();
    expect(view.status).toBe("partly_collected");
  });

  it("looks for a hold again at hand-over and refuses if one opened after booking", async () => {
    const s = setup();
    const b = await booking(s);
    const record = s.facts.records.find((r) => r.lotId === LOTS[0]);
    if (record) record.facts = { ...record.facts, openChecks: ["source_of_funds"] };
    const error = (
      await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[0], LOTS[1]], idCheck })
    )._unsafeUnwrapErr();
    expect(error).toMatchObject({
      code: "hold_open",
      lotId: LOTS[0],
      reason: "source_of_funds_check_open",
    });
    expect((await s.bookings.findById(b.id))?.status).toBe("booked");
    expect(s.handedOver).toEqual([]);
  });

  it("refuses a lot that is not in the booking", async () => {
    const s = setup();
    const b = await booking(s);
    const error = (
      await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[2]], idCheck })
    )._unsafeUnwrapErr();
    expect(error).toMatchObject({ code: "lot_not_in_booking", lotIds: [LOTS[2]] });
  });

  it("cannot hand over a visit that is already closed", async () => {
    const s = setup();
    const b = await booking(s);
    await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[0], LOTS[1]], idCheck });
    const again = await s.service.handOver(STAFF, b.id, {
      lotIds: [LOTS[0], LOTS[1]],
      idCheck,
    });
    expect(again._unsafeUnwrapErr().code).toBe("booking_closed");
  });

  it("puts the booking back if a lot's fulfilment will not move, so the two agree", async () => {
    const s = setup({ [LOTS[1]]: "fail" });
    const b = await booking(s);
    const error = (
      await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[0], LOTS[1]], idCheck })
    )._unsafeUnwrapErr();
    expect(error.code).toBe("fulfilment_failed");
    expect((await s.bookings.findById(b.id))?.status).toBe("booked");
    expect(s.undone).toEqual([LOTS[0]]);
  });
});

describe("undoing a hand-over", () => {
  it("puts the booking and the lots back inside the window, and audits it", async () => {
    const s = setup();
    const b = await booking(s);
    await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[0], LOTS[1]], idCheck });
    s.clock.now = new Date(COLLECTION_NOW.getTime() + 5 * 60_000);
    const view = (await s.service.undoHandOver(STAFF, b.id))._unsafeUnwrap();
    expect(view.status).toBe("booked");
    expect(s.undone.sort()).toEqual([LOTS[0], LOTS[1]].sort());
    expect(s.events.events.at(-1)?.eventType).toBe("collection.booking.hand_over_undone");
  });

  it("is refused once the window has passed", async () => {
    const s = setup();
    const b = await booking(s);
    await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[0], LOTS[1]], idCheck });
    s.clock.now = new Date(COLLECTION_NOW.getTime() + 11 * 60_000);
    expect((await s.service.undoHandOver(STAFF, b.id))._unsafeUnwrapErr().code).toBe(
      "undo_window_passed",
    );
  });

  it("gives the last moment to undo on a handed-over visit", async () => {
    const s = setup();
    const b = await booking(s);
    const view = (
      await s.service.handOver(STAFF, b.id, { lotIds: [LOTS[0], LOTS[1]], idCheck })
    )._unsafeUnwrap();
    expect(view.undoUntil).toBe(new Date(COLLECTION_NOW.getTime() + 10 * 60_000).toISOString());
    expect(view.actions).toContain("undo");
  });
});

describe("not collected", () => {
  it("cannot be marked before the visit starts", async () => {
    const s = setup();
    const b = await booking(s);
    expect((await s.service.markNotCollected(STAFF, b.id))._unsafeUnwrapErr().code).toBe(
      "too_early",
    );
  });

  it("is marked from the start of the time, leaving the lots to collect, and audited", async () => {
    const s = setup();
    const b = await booking(s);
    s.clock.now = new Date(TUESDAY_10);
    const view = (await s.service.markNotCollected(STAFF, b.id))._unsafeUnwrap();
    expect(view.status).toBe("not_collected");
    expect(s.events.events.at(-1)).toMatchObject({
      eventType: "collection.booking.not_collected",
      actorUserId: "staff-1",
    });
    const list = (await s.service.list(VENUE, "not_collected"))._unsafeUnwrap();
    expect(list.items.map((i) => i.id)).toEqual([b.id]);
  });

  it("leaves the follow-up list once the visit has been rebooked", async () => {
    const s = setup();
    const b = await booking(s);
    s.clock.now = new Date(TUESDAY_10);
    await s.service.markNotCollected(STAFF, b.id);
    const rebooked = (
      await s.service.rebook(STAFF, b.id, { version: b.icsSequence, slotStart: WEDNESDAY_10 })
    )._unsafeUnwrap();
    expect(rebooked.id).not.toBe(b.id);
    expect(rebooked.status).toBe("booked");
    expect(rebooked.bookedVia).toBe("staff");
    expect(rebooked.lots.map((l) => l.lotId).sort()).toEqual([LOTS[0], LOTS[1]].sort());
  });
});

describe("rebooking", () => {
  it("moves a live visit to another time with the same rules", async () => {
    const s = setup();
    const b = await booking(s);
    const view = (
      await s.service.rebook(STAFF, b.id, { version: b.icsSequence, slotStart: WEDNESDAY_10 })
    )._unsafeUnwrap();
    expect(view.id).toBe(b.id);
    expect(view.start).toBe(WEDNESDAY_10);
    expect(view.version).toBe(b.icsSequence + 1);
    expect(s.events.events.at(-1)?.eventType).toBe("collection.booking.changed");
  });

  it("needs a reason to go over capacity, and records it", async () => {
    const s = setup();
    await booking(s, { slotStart: WEDNESDAY_10 });
    await booking(s, { slotStart: WEDNESDAY_10, lotIds: [LOTS[2]] });
    const b = await booking(s, { lotIds: [COLLECTION_LOTS.agentWin] });
    const refused = await s.service.rebook(STAFF, b.id, {
      version: b.icsSequence,
      slotStart: WEDNESDAY_10,
    });
    expect(refused._unsafeUnwrapErr().code).toBe("slot_full");
    const allowed = (
      await s.service.rebook(STAFF, b.id, {
        version: b.icsSequence,
        slotStart: WEDNESDAY_10,
        override: { reason: "Client is flying out Thursday" },
      })
    )._unsafeUnwrap();
    expect(allowed.overCapacity).toBe(true);
    const stored = await s.bookings.findById(b.id);
    expect(stored?.overCapacityReason).toBe("Client is flying out Thursday");
  });

  it("needs a reason to go inside the notice period", async () => {
    const s = setup();
    const b = await booking(s, { slotStart: WEDNESDAY_10 });
    s.clock.now = new Date("2026-11-10T17:00:00Z"); // after 16:00 the day before Wednesday
    expect(
      (
        await s.service.rebook(STAFF, b.id, { version: b.icsSequence, slotStart: TUESDAY_1030 })
      )._unsafeUnwrapErr().code,
    ).toBe("notice_passed");
    const inside = await s.service.rebook(STAFF, b.id, {
      version: b.icsSequence,
      slotStart: "2026-11-11T10:30:00.000Z",
      override: { reason: "Phoned the desk" },
    });
    expect(inside.isOk()).toBe(true);
  });

  it("refuses a time the place does not offer, even with a reason", async () => {
    const s = setup();
    const b = await booking(s);
    const result = await s.service.rebook(STAFF, b.id, {
      version: b.icsSequence,
      slotStart: SATURDAY_10,
      override: { reason: "Please" },
    });
    expect(result._unsafeUnwrapErr().code).toBe("slot_unknown");
  });

  it("refuses a stale copy", async () => {
    const s = setup();
    const b = await booking(s);
    const result = await s.service.rebook(STAFF, b.id, {
      version: b.icsSequence + 5,
      slotStart: WEDNESDAY_10,
    });
    expect(result._unsafeUnwrapErr().code).toBe("booking_changed");
  });
});

describe("booking for a client", () => {
  const body = (over: Record<string, unknown> = {}) => ({
    legalEntityId: COLLECTION_ACCOUNT,
    lotIds: [LOTS[0]],
    slotStart: TUESDAY_10,
    collector: { kind: "self" as const, name: "Charlotte Hayes" },
    idempotencyKey: `desk-${Math.random().toString(36).slice(2, 12)}`,
    ...over,
  });

  it("books for the account's lot, by staff, and audits it with their name", async () => {
    const s = setup();
    const { booking: view, replayed } = (
      await s.service.bookForClient(STAFF, body())
    )._unsafeUnwrap();
    expect(replayed).toBe(false);
    expect(view.bookedVia).toBe("staff");
    expect(s.events.events.at(-1)).toMatchObject({
      eventType: "collection.booking.created",
      actorUserId: "staff-1",
      payload: { bookedVia: "staff" },
    });
  });

  it("answers a repeat of the same request with the same booking", async () => {
    const s = setup();
    const request = body();
    const first = (await s.service.bookForClient(STAFF, request))._unsafeUnwrap();
    const second = (await s.service.bookForClient(STAFF, request))._unsafeUnwrap();
    expect(second.replayed).toBe(true);
    expect(second.booking.id).toBe(first.booking.id);
  });

  it("will not book a lot that belongs to another account", async () => {
    const s = setup();
    const result = await s.service.bookForClient(
      STAFF,
      body({ legalEntityId: OTHER_COLLECTION_ACCOUNT }),
    );
    expect(result._unsafeUnwrapErr().code).toBe("lot_not_found");
  });

  it("keeps the booking rules: an unpaid lot cannot be booked", async () => {
    const s = setup();
    const result = await s.service.bookForClient(STAFF, body({ lotIds: [COLLECTION_LOTS.unpaid] }));
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "lot_not_collectable",
      reason: "payment_not_cleared",
    });
  });

  it("needs the client's authorisation for a third party", async () => {
    const s = setup();
    const result = await s.service.bookForClient(
      STAFF,
      body({ collector: { kind: "third_party", name: "Sam Shipper" } }),
    );
    expect(result._unsafeUnwrapErr().code).toBe("collector_invalid");
    const ok2 = await s.service.bookForClient(
      STAFF,
      body({ collector: { kind: "third_party", name: "Sam Shipper", authorised: true } }),
    );
    expect(ok2.isOk()).toBe(true);
  });
});

describe("a client's lots", () => {
  it("lists the account's works at the place with whether each can be booked, and why not", async () => {
    const s = setup();
    const lots = (await s.service.clientLots(VENUE, COLLECTION_ACCOUNT))._unsafeUnwrap();
    const byId = new Map(lots.map((l) => [l.lotId, l]));
    expect(byId.get(COLLECTION_LOTS.one)).toMatchObject({
      collectable: true,
      blockedMessage: null,
    });
    expect(byId.get(COLLECTION_LOTS.unpaid)).toMatchObject({ collectable: false });
    expect(byId.get(COLLECTION_LOTS.unpaid)?.blockedMessage).toMatch(/payment/i);
    expect(byId.has(COLLECTION_LOTS.otherAccount)).toBe(false);
    expect(byId.has(COLLECTION_LOTS.otherPlace)).toBe(false);
  });

  it("refuses an unknown place", async () => {
    const s = setup();
    const result = await s.service.clientLots(
      "c0000000-0000-4000-8000-0000000000cc",
      COLLECTION_ACCOUNT,
    );
    expect(result._unsafeUnwrapErr().code).toBe("place_not_set_up");
  });
});

describe("the day", () => {
  it("groups visits by time with places taken against capacity", async () => {
    const s = setup();
    await booking(s);
    await booking(s, { lotIds: [LOTS[2]] });
    const day = (await s.service.day(VENUE, "2026-11-10"))._unsafeUnwrap();
    expect(day.state).toBe("open");
    expect(day.capacity).toBe(2);
    const group = day.groups.find((g) => g.start === TUESDAY_10);
    expect(group).toMatchObject({ taken: 2, capacity: 2 });
    expect(group?.bookings).toHaveLength(2);
    expect(day.toHandOver).toBe(2);
    expect(day.openTimes).toBe(day.groups.length - 1);
  });

  it("shows each booking with the buyer, the collector, the lots and whether they are released", async () => {
    const s = setup({ [LOTS[1]]: "awaiting_release" });
    await booking(s, { thirdParty: true });
    const view = (await s.service.day(VENUE, "2026-11-10"))._unsafeUnwrap().groups[0]?.bookings[0];
    expect(view?.buyer.name).toBe("Hayes Collection");
    expect(view?.collector.kind).toBe("third_party");
    expect(view?.lots.map((l) => l.released)).toEqual([true, false]);
    expect(view?.handOverBlocked).toBe("not_released");
    expect(view?.actions).toEqual(expect.arrayContaining(["hand_over", "rebook"]));
  });

  it("says a weekend is closed", async () => {
    const s = setup();
    const day = (await s.service.day(VENUE, "2026-11-14"))._unsafeUnwrap();
    expect(day.state).toBe("closed");
    expect(day.groups).toEqual([]);
    expect(day.canOpenAnyway).toBe(false);
  });

  it("says a sale day is closed and can be opened anyway", async () => {
    const s = setup();
    s.places.exceptions = [
      {
        kind: "closure",
        startsOn: "2026-11-12",
        endsOn: "2026-11-12",
        opensLocal: null,
        closesLocal: null,
        source: "sale",
      },
    ];
    const day = (await s.service.day(VENUE, "2026-11-12"))._unsafeUnwrap();
    expect(day.state).toBe("sale_day");
    expect(day.canOpenAnyway).toBe(true);
  });

  it("refuses a bad date and an unknown place", async () => {
    const s = setup();
    expect((await s.service.day(VENUE, "tomorrow"))._unsafeUnwrapErr().code).toBe("invalid_date");
    expect(
      (await s.service.day("c0000000-0000-4000-8000-0000000000cc", "2026-11-10"))._unsafeUnwrapErr()
        .code,
    ).toBe("place_not_set_up");
  });

  it("lists upcoming visits to come", async () => {
    const s = setup();
    const b = await booking(s);
    const list = (await s.service.list(VENUE, "upcoming"))._unsafeUnwrap();
    expect(list.items.map((i) => i.id)).toEqual([b.id]);
  });
});
