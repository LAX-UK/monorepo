import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  collectionBooking,
  collectionBookingLot,
  domainEvent,
  lotFulfilment,
} from "@auction/db/schema";
import {
  DrizzleCollectionBookingRepository,
  DrizzleCollectionDeskFulfilment,
  DrizzleCollectionDeskReader,
  DrizzleCollectionLotFactsReader,
  DrizzleCollectionPlaceRepository,
} from "@auction/persistence/repositories";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DomainEventSink } from "../domain-event-sink.js";
import { DomainEventPublisher } from "../domain-event.publisher.js";
import { CollectionDeskService } from "./collection-desk.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * A check can open on the buyer after the visit was booked: an AML hold on the person who won, or a
 * source-of-funds review. The desk reads the checks again at hand-over, from the same tables the
 * booking path reads, and refuses with the booking path's shape (the lot and the reason), changing
 * nothing. Once the check is closed the same hand-over goes through.
 */
describe.skipIf(!HAS_DB)(
  "collection desk hand-over with a hold opened after booking (integration)",
  () => {
    const run = randomUUID().slice(0, 8);
    const staffId = `desk-hold-staff-${run}`;
    const buyerId = `desk-hold-buyer-${run}`;
    const entityId = randomUUID();
    const venueId = randomUUID();
    const saleId = randomUUID();
    const staff = { userId: staffId };
    const idCheck = { confirmed: true, type: "passport" } as const;

    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const bookings = new DrizzleCollectionBookingRepository(db);
    const places = new DrizzleCollectionPlaceRepository(db);
    const desk = new CollectionDeskService({
      places,
      bookings,
      desk: new DrizzleCollectionDeskReader(db),
      facts: new DrizzleCollectionLotFactsReader(db),
      fulfilment: new DrizzleCollectionDeskFulfilment(),
      events: new DomainEventSink(new DomainEventPublisher(), db),
      now: () => new Date(),
    });

    let slotCounter = 0;
    let lotNumber = 0;

    /** A won, paid lot at the place, released for collection. */
    async function paidLot(): Promise<string> {
      const lotId = randomUUID();
      lotNumber += 1;
      await db.execute(sql`
      insert into lot (id, seller_legal_entity_id, sale_id, title, lot_number, auction_type,
         starting_price, current_price, start_time, end_time, status, winner_id, buyer_legal_entity_id)
      values (${lotId}, ${entityId}, ${saleId}, ${`Hold lot ${lotNumber}`}, ${lotNumber}, 'english',
         100, 100, now() - interval '40 days', now() - interval '20 days', 'ended', ${buyerId}, ${entityId})`);
      await db.execute(sql`
      insert into payment (id, lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id,
         amount, platform_fee, status, created_at)
      values (${randomUUID()}, ${lotId}, ${buyerId}, ${entityId}, ${entityId}, 100, 0,
         'captured'::payment_status, now())`);
      await db.insert(lotFulfilment).values({ lotId, status: "released" });
      return lotId;
    }

    /** A visit booked while nothing was in the way. */
    async function bookedVisit(lotIds: string[]) {
      slotCounter += 1;
      const slotStart = new Date(Date.UTC(2032, 2, 1, 10, 0) + slotCounter * 30 * 60_000);
      const outcome = await bookings.book({
        legalEntityId: entityId,
        venueId,
        slotStart,
        slotEnd: new Date(slotStart.getTime() + 30 * 60_000),
        placesPerSlot: 2,
        overCapacityReason: null,
        lotIds,
        collector: {
          kind: "self",
          name: "Charlotte Hayes",
          email: null,
          company: null,
          userId: buyerId,
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

    const statusOf = async (lotId: string) =>
      (await db.select().from(lotFulfilment).where(eq(lotFulfilment.lotId, lotId)))[0]?.status;
    const bookingStatus = async (bookingId: string) =>
      (await db.select().from(collectionBooking).where(eq(collectionBooking.id, bookingId)))[0]
        ?.status;

    beforeAll(async () => {
      const now = new Date();
      await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${staffId}, 'Staff', ${`${staffId}@integration.test`}, true, ${now}, ${now}),
             (${buyerId}, 'Buyer', ${`${buyerId}@integration.test`}, true, ${now}, ${now})`);
      await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'Hold IT buyer', 'individual', 'private_collector', ${buyerId}, 'approved')`);
      await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${entityId}, 'Hold IT gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`);
      await db.execute(sql`
      insert into sale (id, title, start_time, end_time, venue_id, created_by_legal_entity_id)
      values (${saleId}, 'Hold IT sale', now() - interval '30 days', now() - interval '20 days', ${venueId}, ${entityId})`);
      await db.execute(sql`
      insert into bid_user_profile (user_id, aml_hold_status, created_at, updated_at)
      values (${buyerId}, 'none', now(), now())`);
      await places.ensure(venueId);
    });

    afterEach(async () => {
      await db.execute(
        sql`update bid_user_profile set aml_hold_status = 'none' where user_id = ${buyerId}`,
      );
      await db.execute(sql`delete from source_of_funds where user_id = ${buyerId}`);
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
        await db.delete(domainEvent).where(inArray(domainEvent.aggregateId, bookingIds));
      }
      await db.execute(sql`delete from payment where buyer_legal_entity_id = ${entityId}`);
      await db.execute(sql`delete from lot where seller_legal_entity_id = ${entityId}`);
      await db.execute(sql`delete from sale where id = ${saleId}`);
      await db.execute(sql`delete from collection_weekly_hours where venue_id = ${venueId}`);
      await db.execute(sql`delete from collection_exception where venue_id = ${venueId}`);
      await db.execute(sql`delete from collection_place where venue_id = ${venueId}`);
      await db.execute(sql`delete from venue where id = ${venueId}`);
      await db.execute(sql`delete from bid_user_profile where user_id = ${buyerId}`);
      await db.execute(sql`delete from legal_entity where id = ${entityId}`);
      await db.execute(sql`delete from "user" where id in (${staffId}, ${buyerId})`);
    });

    it("refuses an AML hold placed on the buyer after booking, and changes nothing", async () => {
      const lots = [await paidLot(), await paidLot()];
      const booking = await bookedVisit(lots);
      await db.execute(
        sql`update bid_user_profile set aml_hold_status = 'hold' where user_id = ${buyerId}`,
      );

      const result = await desk.handOver(staff, booking.id, { lotIds: lots, idCheck });

      expect(result._unsafeUnwrapErr()).toMatchObject({
        code: "hold_open",
        status: 409,
        lotId: lots[0],
        reason: "identity_check_open",
      });
      expect(await bookingStatus(booking.id)).toBe("booked");
      expect(await statusOf(lots[0] as string)).toBe("released");
      expect(await statusOf(lots[1] as string)).toBe("released");
    });

    it("refuses a source-of-funds review opened after booking, and changes nothing", async () => {
      const lots = [await paidLot()];
      const booking = await bookedVisit(lots);
      await db.execute(sql`
      insert into source_of_funds (user_id, status, trigger, threshold_amount, exposure_amount)
      values (${buyerId}, 'pending', 'manual', 1000, 2000)`);

      const result = await desk.handOver(staff, booking.id, { lotIds: lots, idCheck });

      expect(result._unsafeUnwrapErr()).toMatchObject({
        code: "hold_open",
        lotId: lots[0],
        reason: "source_of_funds_check_open",
      });
      expect(await bookingStatus(booking.id)).toBe("booked");
      expect(await statusOf(lots[0] as string)).toBe("released");
    });

    it("hands over once the check is closed", async () => {
      const lots = [await paidLot()];
      const booking = await bookedVisit(lots);
      await db.execute(
        sql`update bid_user_profile set aml_hold_status = 'hold' where user_id = ${buyerId}`,
      );
      expect((await desk.handOver(staff, booking.id, { lotIds: lots, idCheck })).isErr()).toBe(
        true,
      );

      await db.execute(
        sql`update bid_user_profile set aml_hold_status = 'none' where user_id = ${buyerId}`,
      );
      const view = (
        await desk.handOver(staff, booking.id, { lotIds: lots, idCheck })
      )._unsafeUnwrap();

      expect(view.status).toBe("collected");
      expect(await statusOf(lots[0] as string)).toBe("delivered");
    });
  },
);
