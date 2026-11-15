import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleAccountPurchaseFactsReader } from "./drizzle-workspace-buying.readers.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/** What a purchase carries for the "please collect by" notice: payment day, free period, place, booking. */
describe.skipIf(!HAS_DB)("account purchase facts: collect-by storage (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const buyer = `cb-facts-buyer-${run}`;
  const buyerEntity = randomUUID();
  const sellerEntity = randomUUID();
  const venueId = randomUUID();
  const bareVenueId = randomUUID();
  const saleId = randomUUID();
  const bareSaleId = randomUUID();
  const cleared = new Date("2031-03-01T10:00:00Z");
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzleAccountPurchaseFactsReader(db);
  const scope = { legalEntityId: buyerEntity, memberUserId: null, limit: 50, offset: 0 };

  let lotNumber = 0;
  async function wonLot(over: { sale?: string; cleared?: Date | null } = {}): Promise<string> {
    const lotId = randomUUID();
    lotNumber += 1;
    await db.execute(sql`
      insert into lot (id, seller_legal_entity_id, sale_id, title, lot_number, auction_type,
         starting_price, current_price, start_time, end_time, status, winner_id, buyer_legal_entity_id)
      values (${lotId}, ${sellerEntity}, ${over.sale ?? saleId}, ${`Facts lot ${lotNumber}`},
         ${lotNumber}, 'english', 100, 100, now() - interval '40 days', now() - interval '20 days',
         'ended', ${buyer}, ${buyerEntity})`);
    await db.execute(sql`
      insert into lot_fulfilment (lot_id, status, fulfilment_method, payment_cleared_at)
      values (${lotId}, 'awaiting_release'::lot_fulfilment_status, null,
         ${over.cleared === undefined ? cleared : over.cleared})`);
    return lotId;
  }
  const storageOf = async (lotId: string) =>
    (await reader.list({ ...scope, lotIds: [lotId] })).find((row) => row.lotId === lotId)?.storage;

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${buyer}, 'Buyer', ${`${buyer}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${buyerEntity}, 'Facts buyer', 'individual', 'private_collector', ${buyer}, 'approved'),
             (${sellerEntity}, 'Facts seller', 'organisation', 'gallery', ${buyer}, 'approved')`);
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${sellerEntity}, 'Facts gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB'),
             (${bareVenueId}, ${sellerEntity}, 'No place set up', '2 Test Street', 'London', 'W1W 6YW', 'GB')`);
    await db.execute(sql`
      insert into sale (id, title, start_time, end_time, venue_id, created_by_legal_entity_id)
      values (${saleId}, 'Facts sale', now() - interval '30 days', now() - interval '20 days', ${venueId}, ${sellerEntity}),
             (${bareSaleId}, 'Bare sale', now() - interval '30 days', now() - interval '20 days', ${bareVenueId}, ${sellerEntity})`);
    await db.execute(sql`
      insert into collection_place (venue_id, free_storage_days, online_booking_enabled)
      values (${venueId}, 14, true)`);
  });

  afterAll(async () => {
    await db.execute(
      sql`delete from collection_booking_lot where lot_id in (select id from lot where seller_legal_entity_id = ${sellerEntity})`,
    );
    await db.execute(sql`delete from collection_booking where legal_entity_id = ${buyerEntity}`);
    await db.execute(
      sql`delete from lot_fulfilment where lot_id in (select id from lot where seller_legal_entity_id = ${sellerEntity})`,
    );
    await db.execute(sql`delete from lot where seller_legal_entity_id = ${sellerEntity}`);
    await db.execute(sql`delete from sale where id in (${saleId}, ${bareSaleId})`);
    await db.execute(sql`delete from collection_place where venue_id = ${venueId}`);
    await db.execute(sql`delete from venue where id in (${venueId}, ${bareVenueId})`);
    await db.execute(sql`delete from legal_entity where id in (${buyerEntity}, ${sellerEntity})`);
    await db.execute(sql`delete from "user" where id = ${buyer}`);
  });

  it("reads the payment day, the place's free period and that booking is open", async () => {
    expect(await storageOf(await wonLot())).toEqual({
      clearedAt: cleared,
      freeStorageDays: 14,
      bookingOpen: true,
      booked: false,
    });
  });

  it("says the lot is booked while it is in a live booking, and not after the booking is released", async () => {
    const lotId = await wonLot();
    const bookingId = randomUUID();
    await db.execute(sql`
      insert into collection_booking (id, reference, legal_entity_id, venue_id, slot_start, slot_end, seat,
         collector_kind, collector_name, idempotency_key, request_fingerprint)
      values (${bookingId}, ${`CB-${run}`}, ${buyerEntity}, ${venueId}, now() + interval '3 days',
         now() + interval '3 days 30 minutes', 1, 'self', 'Buyer', ${`k-${run}`}, 'f')`);
    await db.execute(
      sql`insert into collection_booking_lot (booking_id, lot_id, active) values (${bookingId}, ${lotId}, true)`,
    );
    expect((await storageOf(lotId))?.booked).toBe(true);
    await db.execute(sql`update collection_booking_lot set active = false where lot_id = ${lotId}`);
    expect((await storageOf(lotId))?.booked).toBe(false);
  });

  it("has none for a lot with no clearance day or at a venue with no collection place", async () => {
    expect(await storageOf(await wonLot({ cleared: null }))).toBeNull();
    expect(await storageOf(await wonLot({ sale: bareSaleId }))).toBeNull();
  });
});
