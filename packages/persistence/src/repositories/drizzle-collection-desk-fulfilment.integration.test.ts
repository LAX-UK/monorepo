import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { collectionBooking, collectionBookingLot, lot, lotFulfilment } from "@auction/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  HandOverOutcome,
  NewCollectionBooking,
} from "../interfaces/collection-booking.repository.js";
import { DrizzleCollectionBookingRepository } from "./drizzle-collection-booking.repository.js";
import { DrizzleCollectionDeskFulfilment } from "./drizzle-collection-desk-fulfilment.js";
import { DrizzleCollectionPlaceRepository } from "./drizzle-collection-place.repository.js";
import { DrizzleLotFulfilmentRepository } from "./drizzle-lot-fulfilment.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * The desk's hand-over is one transaction with each lot's fulfilment. These commit real rows from
 * several connections at once, because the point is the race: two actions on one lot must not both
 * succeed, and a failure must leave nothing half done.
 */
describe.skipIf(!HAS_DB)("collection desk hand-over (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const staffId = `desk-it-staff-${run}`;
  const buyerId = `desk-it-buyer-${run}`;
  const entityId = randomUUID();
  const venueId = randomUUID();
  const lotIds: string[] = [];

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const bookings = new DrizzleCollectionBookingRepository(db);
  const places = new DrizzleCollectionPlaceRepository(db);
  const deskFulfilment = new DrizzleCollectionDeskFulfilment();
  const lotFulfilmentRepo = new DrizzleLotFulfilmentRepository(db);

  let slotCounter = 0;
  let lotCounter = 0;
  const freshLots = (n: number) => {
    const taken = lotIds.slice(lotCounter, lotCounter + n);
    if (taken.length < n) throw new Error("Out of fixture lots");
    lotCounter += n;
    return taken;
  };

  async function setFulfilment(lotId: string, status: "released" | "ready_for_collection") {
    await db.insert(lotFulfilment).values({ lotId, status });
  }

  /** A booked visit for lots in the given fulfilment statuses. */
  async function bookedVisit(statuses: Array<"released" | "ready_for_collection">) {
    const lots = freshLots(statuses.length);
    for (const [index, status] of statuses.entries())
      await setFulfilment(lots[index] as string, status);
    slotCounter += 1;
    const slotStart = new Date(Date.UTC(2031, 5, 1, 10, 0) + slotCounter * 30 * 60_000);
    const input: NewCollectionBooking = {
      legalEntityId: entityId,
      venueId,
      slotStart,
      slotEnd: new Date(slotStart.getTime() + 30 * 60_000),
      placesPerSlot: 2,
      overCapacityReason: null,
      lotIds: lots,
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
    };
    const outcome = await bookings.book(input);
    if (outcome.outcome !== "booked") throw new Error(`could not book: ${outcome.outcome}`);
    return { booking: outcome.booking, lots };
  }

  /** What the desk's service does: the booking, then each lot's fulfilment, in one transaction. */
  async function handOver(bookingId: string, lots: string[], failAfterFulfilment = false) {
    return bookings.recordHandOver(
      {
        bookingId,
        handedOverLotIds: lots,
        idCheckType: "passport",
        staffUserId: staffId,
        at: new Date(),
      },
      async (tx) => {
        const moved = await deskFulfilment.handOver(tx, {
          bookingId,
          lotIds: lots,
          collectedBy: "Charlotte Hayes",
          actorUserId: staffId,
          at: new Date(),
        });
        if (!moved.ok) throw new Error(`lot_changed:${moved.lotId}`);
        if (failAfterFulfilment) throw new Error("the event could not be written");
      },
    );
  }

  const statusOf = async (lotId: string) =>
    (await db.select().from(lotFulfilment).where(eq(lotFulfilment.lotId, lotId)))[0]?.status;
  const previousOf = async (bookingId: string, lotId: string) =>
    (
      await db
        .select()
        .from(collectionBookingLot)
        .where(eq(collectionBookingLot.bookingId, bookingId))
    ).find((row) => row.lotId === lotId)?.previousFulfilmentStatus ?? null;

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${staffId}, 'Staff', ${`${staffId}@integration.test`}, true, ${now}, ${now}),
             (${buyerId}, 'Buyer', ${`${buyerId}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'Desk IT buyer', 'individual', 'private_collector', ${buyerId}, 'approved')`);
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${entityId}, 'Desk IT gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`);
    const created = await db.execute<{ id: string }>(sql`
      insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status)
      select gen_random_uuid(), ${entityId}::uuid, 'Desk IT lot ' || n, 'english', 100, 100,
         now() - interval '30 days', now() - interval '20 days', 'ended'
      from generate_series(1, 40) as n
      returning id`);
    lotIds.push(...created.rows.map((row) => row.id));
    await places.ensure(venueId);
  });

  afterAll(async () => {
    const rows = await db
      .select({ id: collectionBooking.id })
      .from(collectionBooking)
      .where(eq(collectionBooking.venueId, venueId));
    const bookingIds = rows.map((row) => row.id);
    if (bookingIds.length > 0) {
      await db
        .delete(collectionBookingLot)
        .where(inArray(collectionBookingLot.bookingId, bookingIds));
      await db.delete(collectionBooking).where(inArray(collectionBooking.id, bookingIds));
    }
    await db.delete(lotFulfilment).where(inArray(lotFulfilment.lotId, lotIds));
    await db.execute(sql`delete from collection_weekly_hours where venue_id = ${venueId}`);
    await db.execute(sql`delete from collection_exception where venue_id = ${venueId}`);
    await db.execute(sql`delete from collection_place where venue_id = ${venueId}`);
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.execute(sql`delete from venue where id = ${venueId}`);
    await db.execute(sql`delete from legal_entity where id = ${entityId}`);
    await db.execute(sql`delete from "user" where id in (${staffId}, ${buyerId})`);
  });

  it("closes the booking and each lot's fulfilment together, remembering where each lot was", async () => {
    const { booking, lots } = await bookedVisit(["released", "ready_for_collection"]);
    const outcome = await handOver(booking.id, lots);
    expect(outcome.outcome).toBe("handed_over");
    expect(await statusOf(lots[0] as string)).toBe("delivered");
    expect(await statusOf(lots[1] as string)).toBe("delivered");
    expect(await previousOf(booking.id, lots[0] as string)).toBe("released");
    expect(await previousOf(booking.id, lots[1] as string)).toBe("ready_for_collection");
    const [row] = await db
      .select()
      .from(lotFulfilment)
      .where(eq(lotFulfilment.lotId, lots[0] as string));
    expect(row).toMatchObject({
      status: "delivered",
      fulfilmentMethod: "collection",
      collectedBy: "Charlotte Hayes",
      collectedByUserId: staffId,
    });
  });

  it("keeps nothing when the step after the fulfilment fails: booking, lots and memory are all as before", async () => {
    const { booking, lots } = await bookedVisit(["released", "released"]);
    await expect(handOver(booking.id, lots, true)).rejects.toThrow("could not be written");
    expect((await bookings.findById(booking.id))?.status).toBe("booked");
    expect(await statusOf(lots[0] as string)).toBe("released");
    expect(await previousOf(booking.id, lots[0] as string)).toBeNull();
  });

  it("lets only one of two hand-overs of the same visit racing each other succeed", async () => {
    const { booking, lots } = await bookedVisit(["released", "released"]);
    const results = await Promise.allSettled([
      handOver(booking.id, lots),
      handOver(booking.id, lots),
    ]);
    const outcomes = results.map((result) =>
      result.status === "fulfilled" ? (result.value as HandOverOutcome).outcome : "rejected",
    );
    expect(outcomes.filter((outcome) => outcome === "handed_over")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === "stale")).toHaveLength(1);
    expect(await statusOf(lots[0] as string)).toBe("delivered");
  });

  it("lets only one of the desk and Lot fulfilment's Mark collected win a lot ready for collection", async () => {
    const { booking, lots } = await bookedVisit(["ready_for_collection"]);
    const lot = lots[0] as string;
    const [desk, other] = await Promise.allSettled([
      handOver(booking.id, lots),
      lotFulfilmentRepo.updateIfStatus(lot, ["ready_for_collection"], {
        status: "delivered",
        collectedBy: "Someone at the counter",
        collectedByUserId: staffId,
        collectedAt: new Date(),
        updatedAt: new Date(),
      }),
    ]);
    const deskWon = desk.status === "fulfilled";
    const otherWon = other.status === "fulfilled" && other.value === true;
    expect(deskWon !== otherWon).toBe(true);
    expect(await statusOf(lot)).toBe("delivered");
    if (deskWon) {
      expect((await bookings.findById(booking.id))?.status).toBe("collected");
    } else {
      // The desk was refused, so the booking is untouched and can be handled another way.
      expect((await bookings.findById(booking.id))?.status).toBe("booked");
    }
  });

  it("refuses a lot another action has already moved, changing nothing", async () => {
    const { booking, lots } = await bookedVisit(["released", "released"]);
    await db
      .update(lotFulfilment)
      .set({ status: "delivered" })
      .where(eq(lotFulfilment.lotId, lots[1] as string));
    await expect(handOver(booking.id, lots)).rejects.toThrow(`lot_changed:${lots[1]}`);
    expect((await bookings.findById(booking.id))?.status).toBe("booked");
    expect(await statusOf(lots[0] as string)).toBe("released");
  });

  it("undoes a hand-over to exactly the status each lot was in", async () => {
    const { booking, lots } = await bookedVisit(["released", "ready_for_collection"]);
    await handOver(booking.id, lots);
    const undone = await bookings.undoHandOver(
      { bookingId: booking.id, at: new Date() },
      async (tx) => {
        const restored = await deskFulfilment.undoHandOver(tx, booking.id);
        if (!restored.ok) throw new Error(`lot_changed:${restored.lotId}`);
      },
    );
    expect(undone.outcome).toBe("undone");
    expect(await statusOf(lots[0] as string)).toBe("released");
    expect(await statusOf(lots[1] as string)).toBe("ready_for_collection");
    expect(await previousOf(booking.id, lots[0] as string)).toBeNull();
    const [row] = await db
      .select()
      .from(lotFulfilment)
      .where(eq(lotFulfilment.lotId, lots[0] as string));
    expect(row?.collectedBy).toBeNull();
    expect(row?.collectedByUserId).toBeNull();
  });

  it("refuses to undo while a lot is no longer delivered, keeping the booking handed over", async () => {
    const { booking, lots } = await bookedVisit(["released"]);
    await handOver(booking.id, lots);
    await db
      .update(lotFulfilment)
      .set({ status: "in_transit" })
      .where(eq(lotFulfilment.lotId, lots[0] as string));
    await expect(
      bookings.undoHandOver({ bookingId: booking.id, at: new Date() }, async (tx) => {
        const restored = await deskFulfilment.undoHandOver(tx, booking.id);
        if (!restored.ok) throw new Error(`lot_changed:${restored.lotId}`);
      }),
    ).rejects.toThrow("lot_changed");
    expect((await bookings.findById(booking.id))?.status).toBe("collected");
  });
});
