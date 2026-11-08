import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { collectionBooking, collectionBookingLot, collectionPlace } from "@auction/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  BookingOutcome,
  NewCollectionBooking,
} from "../interfaces/collection-booking.repository.js";
import { DrizzleCollectionBookingRepository } from "./drizzle-collection-booking.repository.js";
import { DrizzleCollectionPlaceRepository } from "./drizzle-collection-place.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * These tests commit real rows from several connections at once, because the point is the race:
 * rolled-back transactions could not show two requests fighting for the last place.
 */
describe.skipIf(!HAS_DB)("collection booking (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const staffId = `col-it-staff-${run}`;
  const buyerId = `col-it-buyer-${run}`;
  const entityId = randomUUID();
  const venueId = randomUUID();
  const lotIds: string[] = [];

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const bookings = new DrizzleCollectionBookingRepository(db);
  const places = new DrizzleCollectionPlaceRepository(db);

  let slotCounter = 0;
  /** A slot no other test in this file uses. */
  function freshSlot() {
    slotCounter += 1;
    const start = new Date(Date.UTC(2031, 0, 1, 10, 0) + slotCounter * 30 * 60_000);
    return { slotStart: start, slotEnd: new Date(start.getTime() + 30 * 60_000) };
  }

  let lotCounter = 0;
  function freshLots(n: number): string[] {
    const taken = lotIds.slice(lotCounter, lotCounter + n);
    if (taken.length < n) throw new Error("Out of fixture lots");
    lotCounter += n;
    return taken;
  }

  function request(over: Partial<NewCollectionBooking> = {}): NewCollectionBooking {
    const slot = over.slotStart && over.slotEnd ? {} : freshSlot();
    return {
      legalEntityId: entityId,
      venueId,
      ...slot,
      placesPerSlot: 2,
      overCapacityReason: null,
      lotIds: over.lotIds ?? freshLots(1),
      collector: {
        kind: "self",
        name: "Charlotte Hayes",
        email: null,
        company: null,
        userId: null,
        authorisedByUserId: null,
        authorisedAt: null,
        policyVersion: null,
      },
      bookedByUserId: buyerId,
      bookedVia: "client",
      idempotencyKey: randomUUID(),
      ...over,
    };
  }

  const booked = (outcome: BookingOutcome) => {
    if (outcome.outcome !== "booked") throw new Error(`Expected booked, got ${outcome.outcome}`);
    return outcome.booking;
  };

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${staffId}, 'Staff', ${`${staffId}@integration.test`}, true, ${now}, ${now}),
             (${buyerId}, 'Buyer', ${`${buyerId}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'Collection IT buyer', 'individual', 'private_collector', ${buyerId}, 'approved')`);
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${entityId}, 'Collection IT gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`);
    const created = await db.execute<{ id: string }>(sql`
      insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status)
      select gen_random_uuid(), ${entityId}::uuid, 'Collection IT lot ' || n, 'english', 100, 100,
         now() - interval '30 days', now() - interval '20 days', 'ended'
      from generate_series(1, 300) as n
      returning id`);
    lotIds.push(...created.rows.map((row) => row.id));
    await places.ensure(venueId);
  });

  afterAll(async () => {
    const ids = await db
      .select({ id: collectionBooking.id })
      .from(collectionBooking)
      .where(eq(collectionBooking.venueId, venueId));
    const bookingIds = ids.map((row) => row.id);
    if (bookingIds.length > 0) {
      await db
        .delete(collectionBookingLot)
        .where(inArray(collectionBookingLot.bookingId, bookingIds));
      await db.delete(collectionBooking).where(inArray(collectionBooking.id, bookingIds));
    }
    await db.execute(sql`delete from collection_exception where venue_id = ${venueId}`);
    await db.execute(sql`delete from collection_weekly_hours where venue_id = ${venueId}`);
    await db.delete(collectionPlace).where(eq(collectionPlace.venueId, venueId));
    await db.execute(sql`delete from lot where seller_legal_entity_id = ${entityId}`);
    await db.execute(sql`delete from venue where id = ${venueId}`);
    await db.execute(sql`delete from legal_entity where id = ${entityId}`);
    await db.execute(sql`delete from "user" where id in (${staffId}, ${buyerId})`);
  });

  describe("the last place", () => {
    it("lets exactly two of twenty parallel bookings take the two places of a slot", async () => {
      const slot = freshSlot();
      const racingLots = freshLots(20);
      const attempts = racingLots.map((lotId) =>
        bookings.book(request({ ...slot, lotIds: [lotId] })),
      );

      const outcomes = await Promise.all(attempts);

      const winners = outcomes.filter((o) => o.outcome === "booked");
      const full = outcomes.filter((o) => o.outcome === "slot_full");
      expect(winners).toHaveLength(2);
      expect(full).toHaveLength(18);

      const stored = await db
        .select()
        .from(collectionBooking)
        .where(eq(collectionBooking.slotStart, slot.slotStart));
      expect(stored).toHaveLength(2);
      expect(stored.map((row) => row.seat).sort()).toEqual([1, 2]);
      expect(stored.every((row) => row.status === "booked" && !row.overCapacity)).toBe(true);

      const taken = await bookings.takenPlaces(venueId, {
        from: slot.slotStart,
        to: slot.slotEnd,
      });
      expect(taken.get(slot.slotStart.getTime())).toBe(2);

      // The twenty lots that lost were not left half-booked.
      const held = await db
        .select()
        .from(collectionBookingLot)
        .where(inArray(collectionBookingLot.lotId, racingLots));
      expect(held).toHaveLength(2);
    });

    it("gives the last of three places to exactly one of five racing for it", async () => {
      const slot = freshSlot();
      const first = booked(await bookings.book(request({ ...slot, placesPerSlot: 3 })));
      const second = booked(await bookings.book(request({ ...slot, placesPerSlot: 3 })));
      expect([first.seat, second.seat]).toEqual([1, 2]);

      const racers = await Promise.all(
        Array.from({ length: 5 }, () => bookings.book(request({ ...slot, placesPerSlot: 3 }))),
      );
      expect(racers.filter((o) => o.outcome === "booked")).toHaveLength(1);
      expect(racers.filter((o) => o.outcome === "slot_full")).toHaveLength(4);
      const winner = racers.find((o) => o.outcome === "booked");
      expect(winner?.outcome === "booked" && winner.booking.seat).toBe(3);
    });

    it("lets a staff member go beyond capacity with a reason, and records it", async () => {
      const slot = freshSlot();
      booked(await bookings.book(request({ ...slot, placesPerSlot: 1 })));
      expect((await bookings.book(request({ ...slot, placesPerSlot: 1 }))).outcome).toBe(
        "slot_full",
      );
      const over = booked(
        await bookings.book(
          request({
            ...slot,
            placesPerSlot: 1,
            bookedVia: "staff",
            bookedByUserId: staffId,
            overCapacityReason: "Client phoned from the saleroom",
          }),
        ),
      );
      expect(over).toMatchObject({
        seat: 2,
        overCapacity: true,
        overCapacityReason: "Client phoned from the saleroom",
        bookedVia: "staff",
      });
    });

    it("gives a cancelled booking's place to the next person", async () => {
      const slot = freshSlot();
      const a = booked(await bookings.book(request({ ...slot, placesPerSlot: 1 })));
      expect((await bookings.book(request({ ...slot, placesPerSlot: 1 }))).outcome).toBe(
        "slot_full",
      );
      const cancelled = await bookings.cancel({
        bookingId: a.id,
        expectedSequence: a.icsSequence,
        cancelledByUserId: buyerId,
        at: new Date(),
      });
      expect(cancelled.outcome).toBe("cancelled");
      const b = booked(await bookings.book(request({ ...slot, placesPerSlot: 1 })));
      expect(b.seat).toBe(1);
    });
  });

  describe("a request sent twice", () => {
    it("books once when the same key arrives ten times at once", async () => {
      const input = request();
      const outcomes = await Promise.all(
        Array.from({ length: 10 }, () => bookings.book({ ...input })),
      );
      expect(outcomes.filter((o) => o.outcome === "booked")).toHaveLength(1);
      expect(outcomes.filter((o) => o.outcome === "replayed")).toHaveLength(9);
      const ids = new Set(
        outcomes.flatMap((o) =>
          o.outcome === "slot_full" || o.outcome === "lot_taken" ? [] : [o.booking.id],
        ),
      );
      expect(ids.size).toBe(1);
      const rows = await db
        .select()
        .from(collectionBooking)
        .where(eq(collectionBooking.idempotencyKey, input.idempotencyKey));
      expect(rows).toHaveLength(1);
    });

    it("returns the original booking for a later repeat", async () => {
      const input = request();
      const first = booked(await bookings.book(input));
      const again = await bookings.book({ ...input });
      expect(again).toMatchObject({ outcome: "replayed", booking: { id: first.id } });
    });

    it("treats the same key on another account as a different request", async () => {
      const input = request();
      booked(await bookings.book(input));
      const otherEntity = randomUUID();
      await db.execute(sql`
        insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
        values (${otherEntity}, 'Other buyer', 'individual', 'private_collector', ${buyerId}, 'approved')`);
      try {
        const other = await bookings.book({
          ...input,
          legalEntityId: otherEntity,
          ...freshSlot(),
          lotIds: freshLots(1),
        });
        expect(other.outcome).toBe("booked");
        if (other.outcome === "booked") {
          await db
            .delete(collectionBookingLot)
            .where(eq(collectionBookingLot.bookingId, other.booking.id));
          await db.delete(collectionBooking).where(eq(collectionBooking.id, other.booking.id));
        }
      } finally {
        await db.execute(sql`delete from legal_entity where id = ${otherEntity}`);
      }
    });
  });

  describe("lots", () => {
    it("lets only one of two bookings that name the same lot succeed, and stores nothing for the other", async () => {
      const [lot] = freshLots(1) as [string];
      const [a, b] = await Promise.all([
        bookings.book(request({ lotIds: [lot] })),
        bookings.book(request({ lotIds: [lot] })),
      ]);
      const outcomes = [a.outcome, b.outcome].sort();
      expect(outcomes).toEqual(["booked", "lot_taken"]);
      const loser = a.outcome === "lot_taken" ? a : b;
      expect(loser.outcome === "lot_taken" && loser.lotIds).toEqual([lot]);
      const rows = await db
        .select()
        .from(collectionBookingLot)
        .where(eq(collectionBookingLot.lotId, lot));
      expect(rows).toHaveLength(1);
    });

    it("holds every lot of a visit together, and frees them all on cancel", async () => {
      const lots = freshLots(3);
      const visit = booked(await bookings.book(request({ lotIds: lots })));
      expect(visit.lots.map((l) => l.lotId).sort()).toEqual([...lots].sort());
      expect(visit.lots.every((l) => l.active)).toBe(true);

      const live = await bookings.findLiveByLots(lots);
      expect([...live.keys()].sort()).toEqual([...lots].sort());

      await bookings.cancel({
        bookingId: visit.id,
        expectedSequence: visit.icsSequence,
        cancelledByUserId: buyerId,
        at: new Date(),
      });
      expect((await bookings.findLiveByLots(lots)).size).toBe(0);
      // They can be booked again.
      booked(await bookings.book(request({ lotIds: lots })));
    });

    it("books nothing when one lot of several is already held", async () => {
      const [held, free] = freshLots(2) as [string, string];
      booked(await bookings.book(request({ lotIds: [held] })));
      const slot = freshSlot();
      const outcome = await bookings.book(request({ ...slot, lotIds: [free, held] }));
      expect(outcome).toEqual({ outcome: "lot_taken", lotIds: [held] });
      const taken = await bookings.takenPlaces(venueId, slot);
      expect(taken.get(slot.slotStart.getTime())).toBeUndefined();
      expect((await bookings.findLiveByLots([free])).size).toBe(0);
    });
  });

  describe("changing a booking", () => {
    it("moves it to a free slot, releases the old place and raises the sequence", async () => {
      const original = booked(await bookings.book(request({ placesPerSlot: 1 })));
      const target = freshSlot();
      const changed = await bookings.change({
        bookingId: original.id,
        expectedSequence: original.icsSequence,
        ...target,
        placesPerSlot: 1,
        overCapacityReason: null,
        lotIds: original.lots.map((l) => l.lotId),
        collector: {
          kind: "third_party",
          name: "Sam Okoro",
          email: "sam@example.com",
          company: "Okoro Shipping",
          userId: null,
          authorisedByUserId: buyerId,
          authorisedAt: new Date(),
          policyVersion: "2026-11",
        },
      });
      expect(changed.outcome).toBe("changed");
      if (changed.outcome !== "changed") return;
      expect(changed.booking).toMatchObject({
        id: original.id,
        reference: original.reference,
        slotStart: target.slotStart,
        seat: 1,
        icsSequence: original.icsSequence + 1,
        collector: { kind: "third_party", name: "Sam Okoro", email: "sam@example.com" },
      });
      // The place it left is free for someone else.
      booked(
        await bookings.book(
          request({ slotStart: original.slotStart, slotEnd: original.slotEnd, placesPerSlot: 1 }),
        ),
      );
    });

    it("keeps the old time when the new slot is full", async () => {
      const full = freshSlot();
      booked(await bookings.book(request({ ...full, placesPerSlot: 1 })));
      const mine = booked(await bookings.book(request({ placesPerSlot: 1 })));
      const outcome = await bookings.change({
        bookingId: mine.id,
        expectedSequence: mine.icsSequence,
        ...full,
        placesPerSlot: 1,
        overCapacityReason: null,
        lotIds: mine.lots.map((l) => l.lotId),
        collector: { ...collectorOf(mine) },
      });
      expect(outcome.outcome).toBe("slot_full");
      const after = await bookings.findById(mine.id);
      expect(after).toMatchObject({
        slotStart: mine.slotStart,
        seat: mine.seat,
        status: "booked",
        icsSequence: mine.icsSequence,
      });
    });

    it("lets only one of two changes racing for the last place win", async () => {
      const target = freshSlot();
      const a = booked(await bookings.book(request({ placesPerSlot: 1 })));
      const b = booked(await bookings.book(request({ placesPerSlot: 1 })));
      const change = (booking: typeof a) =>
        bookings.change({
          bookingId: booking.id,
          expectedSequence: booking.icsSequence,
          ...target,
          placesPerSlot: 1,
          overCapacityReason: null,
          lotIds: booking.lots.map((l) => l.lotId),
          collector: collectorOf(booking),
        });
      const outcomes = (await Promise.all([change(a), change(b)])).map((o) => o.outcome).sort();
      expect(outcomes).toEqual(["changed", "slot_full"]);
      const taken = await bookings.takenPlaces(venueId, target);
      expect(taken.get(target.slotStart.getTime())).toBe(1);
    });

    it("refuses a change made on an out-of-date copy", async () => {
      const mine = booked(await bookings.book(request()));
      const ok = await bookings.change({
        bookingId: mine.id,
        expectedSequence: mine.icsSequence,
        slotStart: mine.slotStart,
        slotEnd: mine.slotEnd,
        placesPerSlot: 2,
        overCapacityReason: null,
        lotIds: mine.lots.map((l) => l.lotId),
        collector: { ...collectorOf(mine), name: "Charlotte A. Hayes" },
      });
      expect(ok.outcome).toBe("changed");
      const stale = await bookings.change({
        bookingId: mine.id,
        expectedSequence: mine.icsSequence,
        slotStart: mine.slotStart,
        slotEnd: mine.slotEnd,
        placesPerSlot: 2,
        overCapacityReason: null,
        lotIds: mine.lots.map((l) => l.lotId),
        collector: collectorOf(mine),
      });
      expect(stale.outcome).toBe("stale");
      expect(
        (await bookings.change({ ...staleInput(mine), bookingId: randomUUID() })).outcome,
      ).toBe("not_found");
    });

    it("adds and removes lots, and refuses one held elsewhere", async () => {
      const [a, b, c] = freshLots(3) as [string, string, string];
      const other = booked(await bookings.book(request({ lotIds: [c] })));
      const mine = booked(await bookings.book(request({ lotIds: [a, b] })));
      const slim = await bookings.change({
        ...staleInput(mine),
        lotIds: [b],
      });
      expect(slim.outcome).toBe("changed");
      if (slim.outcome === "changed") {
        expect(slim.booking.lots.filter((l) => l.active).map((l) => l.lotId)).toEqual([b]);
        expect(slim.booking.lots.find((l) => l.lotId === a)?.active).toBe(false);
      }
      // The lot dropped is free for someone else; one held elsewhere cannot be added.
      expect((await bookings.findLiveByLots([a])).size).toBe(0);
      const current = await bookings.findById(mine.id);
      const clash = await bookings.change({
        ...staleInput(current as typeof mine),
        lotIds: [b, c],
      });
      expect(clash).toEqual({ outcome: "lot_taken", lotIds: [c] });
      expect((await bookings.findById(other.id))?.status).toBe("booked");
      // ...and the lot dropped earlier can come back.
      const back = await bookings.change({
        ...staleInput((await bookings.findById(mine.id)) as typeof mine),
        lotIds: [a, b],
      });
      expect(back.outcome).toBe("changed");
    });
  });

  describe("at the desk", () => {
    it("hands over some lots, leaves the rest behind, and frees the place and the lots", async () => {
      const lots = freshLots(3);
      const slot = freshSlot();
      const visit = booked(
        await bookings.book(request({ ...slot, lotIds: lots, placesPerSlot: 1 })),
      );
      const done = await bookings.recordHandOver({
        bookingId: visit.id,
        handedOverLotIds: [lots[0] as string, lots[1] as string],
        idCheckType: "passport",
        staffUserId: staffId,
        at: new Date("2031-01-01T10:10:00Z"),
      });
      expect(done.outcome).toBe("handed_over");
      if (done.outcome !== "handed_over") return;
      expect(done.leftLotIds).toEqual([lots[2]]);
      expect(done.booking).toMatchObject({
        status: "partly_collected",
        idCheckType: "passport",
        outcomeByUserId: staffId,
      });
      expect(done.booking.lots.map((l) => [l.lotId, l.outcome, l.active]).sort()).toEqual(
        [
          [lots[0], "collected", false],
          [lots[1], "collected", false],
          [lots[2], "left", false],
        ].sort(),
      );
      // The place is free; the left-behind lot can be booked again.
      booked(
        await bookings.book(request({ ...slot, lotIds: [lots[2] as string], placesPerSlot: 1 })),
      );
    });

    it("marks a handed-over booking collected when every lot goes", async () => {
      const [lot] = freshLots(1) as [string];
      const visit = booked(await bookings.book(request({ lotIds: [lot] })));
      const done = await bookings.recordHandOver({
        bookingId: visit.id,
        handedOverLotIds: [lot],
        idCheckType: "driving_licence",
        staffUserId: staffId,
        at: new Date(),
      });
      expect(done).toMatchObject({ outcome: "handed_over", booking: { status: "collected" } });
      expect(
        (
          await bookings.recordHandOver({
            bookingId: visit.id,
            handedOverLotIds: [lot],
            idCheckType: "passport",
            staffUserId: staffId,
            at: new Date(),
          })
        ).outcome,
      ).toBe("stale");
    });

    it("refuses to hand over a lot that is not in the booking", async () => {
      const visit = booked(await bookings.book(request()));
      const [stranger] = freshLots(1) as [string];
      expect(
        await bookings.recordHandOver({
          bookingId: visit.id,
          handedOverLotIds: [stranger],
          idCheckType: "passport",
          staffUserId: staffId,
          at: new Date(),
        }),
      ).toEqual({ outcome: "lot_not_in_booking", lotIds: [stranger] });
      expect((await bookings.findById(visit.id))?.status).toBe("booked");
    });

    it("marks a missed visit not collected and frees its lots", async () => {
      const [lot] = freshLots(1) as [string];
      const visit = booked(await bookings.book(request({ lotIds: [lot] })));
      const marked = await bookings.markNotCollected({
        bookingId: visit.id,
        staffUserId: staffId,
        at: new Date(),
      });
      expect(marked).toMatchObject({ outcome: "marked", booking: { status: "not_collected" } });
      expect((await bookings.findLiveByLots([lot])).size).toBe(0);
      booked(await bookings.book(request({ lotIds: [lot] })));
      expect(
        (
          await bookings.markNotCollected({
            bookingId: visit.id,
            staffUserId: staffId,
            at: new Date(),
          })
        ).outcome,
      ).toBe("stale");
    });

    it("undoes a hand-over: back to booked in its own place, with its lots", async () => {
      const lots = freshLots(2);
      const slot = freshSlot();
      const visit = booked(await bookings.book(request({ ...slot, lotIds: lots })));
      await bookings.recordHandOver({
        bookingId: visit.id,
        handedOverLotIds: [lots[0] as string],
        idCheckType: "passport",
        staffUserId: staffId,
        at: new Date(),
      });
      const undone = await bookings.undoHandOver({ bookingId: visit.id, at: new Date() });
      expect(undone.outcome).toBe("undone");
      if (undone.outcome !== "undone") return;
      expect(undone.booking).toMatchObject({
        status: "booked",
        seat: visit.seat,
        idCheckType: null,
        outcomeAt: null,
        outcomeByUserId: null,
      });
      expect(undone.booking.lots.every((l) => l.active && l.outcome === null)).toBe(true);
      expect((await bookings.takenPlaces(venueId, slot)).get(slot.slotStart.getTime())).toBe(1);
    });

    it("cannot undo a hand-over once a left-behind lot has been booked again", async () => {
      const lots = freshLots(2);
      const visit = booked(await bookings.book(request({ lotIds: lots })));
      await bookings.recordHandOver({
        bookingId: visit.id,
        handedOverLotIds: [lots[0] as string],
        idCheckType: "passport",
        staffUserId: staffId,
        at: new Date(),
      });
      booked(await bookings.book(request({ lotIds: [lots[1] as string] })));
      expect(await bookings.undoHandOver({ bookingId: visit.id, at: new Date() })).toEqual({
        outcome: "lot_taken",
        lotIds: [lots[1]],
      });
      expect((await bookings.findById(visit.id))?.status).toBe("partly_collected");
    });

    it("does not undo a booking that was never handed over", async () => {
      const visit = booked(await bookings.book(request()));
      expect((await bookings.undoHandOver({ bookingId: visit.id, at: new Date() })).outcome).toBe(
        "stale",
      );
      expect(
        (await bookings.undoHandOver({ bookingId: randomUUID(), at: new Date() })).outcome,
      ).toBe("not_found");
    });

    it("puts an undone booking in another place if its own was taken", async () => {
      const slot = freshSlot();
      const visit = booked(await bookings.book(request({ ...slot, placesPerSlot: 1 })));
      await bookings.recordHandOver({
        bookingId: visit.id,
        handedOverLotIds: visit.lots.map((l) => l.lotId),
        idCheckType: "passport",
        staffUserId: staffId,
        at: new Date(),
      });
      booked(await bookings.book(request({ ...slot, placesPerSlot: 1 })));
      const undone = await bookings.undoHandOver({ bookingId: visit.id, at: new Date() });
      expect(undone.outcome).toBe("undone");
      if (undone.outcome === "undone") expect(undone.booking.seat).toBe(2);
    });
  });

  describe("reading", () => {
    it("finds a booking by id and by reference, with the lots", async () => {
      const visit = booked(await bookings.book(request({ lotIds: freshLots(2) })));
      expect(visit.reference).toMatch(/^COL-\d{4,}$/);
      expect((await bookings.findById(visit.id))?.lots).toHaveLength(2);
      expect((await bookings.findByReference(visit.reference))?.id).toBe(visit.id);
      expect(await bookings.findByReference("COL-0")).toBeNull();
      expect(await bookings.findById(randomUUID())).toBeNull();
    });

    it("lists an account's bookings newest visit first, and a range earliest first", async () => {
      const later = booked(await bookings.book(request()));
      const earlier = booked(
        await bookings.book(
          request({
            slotStart: new Date(later.slotStart.getTime() - 3 * 24 * 3_600_000),
            slotEnd: new Date(later.slotEnd.getTime() - 3 * 24 * 3_600_000),
          }),
        ),
      );
      const mine = await bookings.listForAccount(entityId, 500);
      expect(mine.findIndex((b) => b.id === later.id)).toBeLessThan(
        mine.findIndex((b) => b.id === earlier.id),
      );
      const range = await bookings.listInRange(venueId, {
        from: earlier.slotStart,
        to: new Date(later.slotEnd.getTime() + 1),
      });
      const ids = range.map((b) => b.id);
      expect(ids.indexOf(earlier.id)).toBeLessThan(ids.indexOf(later.id));
    });
  });

  describe("settings", () => {
    it("creates a place with the gallery's hours once, however many ask at the same time", async () => {
      const fresh = randomUUID();
      await db.execute(sql`
        insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
        values (${fresh}, ${entityId}, 'Fresh gallery', '2 Test Street', 'London', 'W1W 6YW', 'GB')`);
      try {
        const results = await Promise.all(Array.from({ length: 8 }, () => places.ensure(fresh)));
        expect(results.every((r) => r.visitMinutes === 30 && r.placesPerSlot === 2)).toBe(true);
        expect(results.every((r) => r.onlineBookingEnabled === false)).toBe(true);
        const facts = await places.readCalendarFacts(fresh, {
          from: "2031-01-01",
          to: "2031-12-31",
        });
        expect(facts.hours).toHaveLength(5);
        expect(facts.hours.map((h) => h.weekday)).toEqual([1, 2, 3, 4, 5]);
        expect(
          facts.hours.every((h) => h.opensLocal === "10:00" && h.closesLocal === "19:00"),
        ).toBe(true);
        expect(facts.exceptions).toEqual([]);
        expect(await places.find(randomUUID())).toBeNull();
      } finally {
        await db.execute(sql`delete from collection_weekly_hours where venue_id = ${fresh}`);
        await db.execute(sql`delete from collection_place where venue_id = ${fresh}`);
        await db.execute(sql`delete from venue where id = ${fresh}`);
      }
    });

    it("reads the exceptions that touch a range, and not removed ones", async () => {
      await db.execute(sql`
        insert into collection_exception (venue_id, kind, starts_on, ends_on, source, deleted_at)
        values
          (${venueId}, 'closure', '2031-06-10', '2031-06-12', 'staff', null),
          (${venueId}, 'closure', '2031-07-01', '2031-07-01', 'staff', null),
          (${venueId}, 'closure', '2031-06-11', '2031-06-11', 'staff', now())`);
      const facts = await places.readCalendarFacts(venueId, {
        from: "2031-06-11",
        to: "2031-06-20",
      });
      expect(facts.exceptions).toEqual([
        {
          kind: "closure",
          startsOn: "2031-06-10",
          endsOn: "2031-06-12",
          opensLocal: null,
          closesLocal: null,
          source: "staff",
        },
      ]);
    });
  });
});

function collectorOf(booking: {
  collector: {
    kind: "self" | "member" | "third_party";
    name: string;
    email: string | null;
    company: string | null;
    userId: string | null;
  };
  authorisedByUserId: string | null;
  authorisedAt: Date | null;
  policyVersion: string | null;
}) {
  return {
    ...booking.collector,
    authorisedByUserId: booking.authorisedByUserId,
    authorisedAt: booking.authorisedAt,
    policyVersion: booking.policyVersion,
  };
}

function staleInput(
  booking: Parameters<typeof collectorOf>[0] & {
    id: string;
    icsSequence: number;
    slotStart: Date;
    slotEnd: Date;
    lots: { lotId: string; active: boolean }[];
  },
) {
  return {
    bookingId: booking.id,
    expectedSequence: booking.icsSequence,
    slotStart: booking.slotStart,
    slotEnd: booking.slotEnd,
    placesPerSlot: 2,
    overCapacityReason: null,
    lotIds: booking.lots.filter((l) => l.active).map((l) => l.lotId),
    collector: collectorOf(booking),
  };
}
