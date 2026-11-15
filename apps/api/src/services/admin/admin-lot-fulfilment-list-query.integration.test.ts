import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { collectionBooking, collectionBookingLot, lot, lotFulfilment } from "@auction/db/schema";
import {
  DrizzleCollectionBookingRepository,
  DrizzleCollectionPlaceRepository,
  DrizzleLotFulfilmentRepository,
} from "@auction/persistence";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AdminLotFulfilmentListQueryService } from "./admin-lot-fulfilment-list-query.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/** A mixed page (booked, not booked, collected) reads its visits through one call. */
describe.skipIf(!HAS_DB)("lot fulfilment queue: Collection read (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const buyerId = `lfq-it-buyer-${run}`;
  const entityId = randomUUID();
  const venueId = randomUUID();
  const title = `LFQ${run}`;
  let lotIds: string[] = [];

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const bookings = new DrizzleCollectionBookingRepository(db);
  const places = new DrizzleCollectionPlaceRepository(db);
  const fulfilment = new DrizzleLotFulfilmentRepository(db);

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${buyerId}, 'Buyer', ${`${buyerId}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'LFQ IT buyer', 'individual', 'private_collector', ${buyerId}, 'approved')`);
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${entityId}, 'LFQ IT gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`);
    const created = await db.execute<{ id: string }>(sql`
      insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status)
      select gen_random_uuid(), ${entityId}::uuid, ${title} || ' lot ' || n, 'english', 100, 100,
         now() - interval '30 days', now() - interval '20 days', 'ended'
      from generate_series(1, 3) as n
      returning id`);
    lotIds = created.rows.map((row) => row.id);
    await places.ensure(venueId);
    await db.insert(lotFulfilment).values([
      { lotId: lotIds[0] as string, status: "released", fulfilmentMethod: "collection" },
      { lotId: lotIds[1] as string, status: "released", fulfilmentMethod: "collection" },
      { lotId: lotIds[2] as string, status: "released", fulfilmentMethod: "collection" },
    ]);
  });

  afterAll(async () => {
    const rows = await db
      .select({ id: collectionBooking.id })
      .from(collectionBooking)
      .where(eq(collectionBooking.venueId, venueId));
    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      await db.delete(collectionBookingLot).where(inArray(collectionBookingLot.bookingId, ids));
      await db.delete(collectionBooking).where(inArray(collectionBooking.id, ids));
    }
    await db.delete(lotFulfilment).where(inArray(lotFulfilment.lotId, lotIds));
    await db.execute(sql`delete from collection_weekly_hours where venue_id = ${venueId}`);
    await db.execute(sql`delete from collection_exception where venue_id = ${venueId}`);
    await db.execute(sql`delete from collection_place where venue_id = ${venueId}`);
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.execute(sql`delete from venue where id = ${venueId}`);
    await db.execute(sql`delete from legal_entity where id = ${entityId}`);
    await db.execute(sql`delete from "user" where id = ${buyerId}`);
  });

  async function book(lotId: string, hour: number) {
    const slotStart = new Date(Date.UTC(2031, 6, 1, hour, 0));
    const outcome = await bookings.book({
      legalEntityId: entityId,
      venueId,
      slotStart,
      slotEnd: new Date(slotStart.getTime() + 30 * 60_000),
      placesPerSlot: 2,
      overCapacityReason: null,
      lotIds: [lotId],
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
    });
    if (outcome.outcome !== "booked") throw new Error(`could not book: ${outcome.outcome}`);
    return outcome.booking;
  }

  it("gives only the live visit to its lot, in one findLiveByLots call", async () => {
    const [booked, notBooked, collected] = lotIds as [string, string, string];
    const liveBooking = await book(booked, 10);
    const handedOver = await book(collected, 11);
    // Hand-over: the booking's lot row goes inactive and the lot is delivered.
    await db
      .update(collectionBookingLot)
      .set({ active: false })
      .where(eq(collectionBookingLot.bookingId, handedOver.id));
    await db
      .update(lotFulfilment)
      .set({ status: "delivered" })
      .where(eq(lotFulfilment.lotId, collected));

    const findLiveByLots = vi.fn((ids: readonly string[]) => bookings.findLiveByLots(ids));
    const service = new AdminLotFulfilmentListQueryService(fulfilment, { findLiveByLots });
    const page = await service.getPage({ q: title, limit: 50, offset: 0 });

    expect(findLiveByLots).toHaveBeenCalledTimes(1);
    expect([...(findLiveByLots.mock.calls[0]?.[0] ?? [])].sort()).toEqual([...lotIds].sort());
    const byLot = new Map(page.rows.map((row) => [row.lotId, row]));
    expect(byLot.get(booked)?.collectionVisit).toEqual({
      start: liveBooking.slotStart.toISOString(),
      end: liveBooking.slotEnd.toISOString(),
    });
    expect(byLot.get(notBooked)?.collectionVisit).toBeNull();
    expect(byLot.get(collected)?.collectionVisit).toBeNull();
    expect(byLot.get(collected)?.status).toBe("delivered");
  });
});
