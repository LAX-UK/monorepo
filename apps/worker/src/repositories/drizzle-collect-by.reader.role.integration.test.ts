import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { MAX_FREE_STORAGE_DAYS } from "@auction/domain";
import { readCollectByCalendars } from "@auction/persistence/lib";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectByGroups } from "../services/collect-by-notices.js";
import { DrizzleCollectByReader } from "./drizzle-collect-by.reader.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * The collect-by reminder sweep run as `worker_app`, which can read the collection calendar but
 * not write to it. The reader tests run as the owner role and so cannot show a missing grant: a
 * reader that set a place up or stored bank holidays as it read would fail here with `permission
 * denied`, and in production on every sweep.
 */
describe.skipIf(!ownerUrl || !workerUrl)("collect-by reader as worker_app (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const buyer = `cb-role-buyer-${run}`;
  const buyerEntity = randomUUID();
  const sellerEntity = randomUUID();
  const venueId = randomUUID();
  const saleId = randomUUID();
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const owner = createDb(ownerUrl!);
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const worker = createDb(workerUrl!);
  const reader = new DrizzleCollectByReader(worker);
  // A lot won before the place had terms is held 30 days free (ST9): from Thu 13 Feb 2031 that is
  // Sat 15 Mar; staff are closed from the Monday to the Wednesday after, so the deadline is Thu 20 Mar.
  const clearedAt = new Date("2031-02-13T12:00:00Z");
  const window = { today: "2031-03-20" };
  const termsId = randomUUID();
  let lotId = "";

  beforeAll(async () => {
    const now = new Date();
    await owner.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${buyer}, 'Buyer', ${`${buyer}@integration.test`}, true, ${now}, ${now})`);
    await owner.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${buyerEntity}, 'Role buyer', 'individual', 'private_collector', ${buyer}, 'approved'),
             (${sellerEntity}, 'Role seller', 'organisation', 'gallery', ${buyer}, 'approved')`);
    await owner.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${sellerEntity}, 'Role gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`);
    await owner.execute(sql`
      insert into sale (id, title, start_time, end_time, venue_id, created_by_legal_entity_id)
      values (${saleId}, 'Role sale', now() - interval '30 days', now() - interval '20 days', ${venueId}, ${sellerEntity})`);
    await owner.execute(sql`
      insert into collection_place (venue_id, free_storage_days, online_booking_enabled)
      values (${venueId}, ${MAX_FREE_STORAGE_DAYS}, true)`);
    await owner.execute(sql`
      insert into collection_weekly_hours (venue_id, weekday, opens_local, closes_local)
      select ${venueId}, d, '10:00', '19:00' from generate_series(1, 5) as d`);
    await owner.execute(sql`
      insert into collection_exception (venue_id, kind, starts_on, ends_on, source)
      values (${venueId}, 'closure', '2031-03-17', '2031-03-19', 'staff')`);
    // Terms recorded when the sale closed, so the sweep reads `collection_storage_terms` (and the
    // extension, waiver and quote tables with it) as `worker_app`. 30 days calendar, as the lot
    // was held before the place had terms, keeps the deadline below unchanged.
    await owner.execute(sql`
      insert into collection_storage_terms (id, venue_id, free_days, count_mode, standard_daily_pence,
         large_daily_pence, handling_fee_pence, effective_from, reason)
      values (${termsId}, ${venueId}, ${MAX_FREE_STORAGE_DAYS}, 'calendar', 300, 600, 0, '2031-01-01', 'Role terms')`);
    lotId = randomUUID();
    await owner.execute(sql`
      insert into lot (id, seller_legal_entity_id, sale_id, title, lot_number, auction_type,
         starting_price, current_price, start_time, end_time, status, winner_id, buyer_legal_entity_id)
      values (${lotId}, ${sellerEntity}, ${saleId}, 'Role lot', 1, 'english', 100, 100,
         now() - interval '40 days', now() - interval '20 days', 'ended', ${buyer}, ${buyerEntity})`);
    await owner.execute(sql`
      insert into lot_fulfilment (lot_id, status, payment_cleared_at, storage_terms_id)
      values (${lotId}, 'awaiting_release'::lot_fulfilment_status, ${clearedAt}, ${termsId})`);
  });

  afterAll(async () => {
    await owner.execute(sql`delete from lot_fulfilment where lot_id = ${lotId}`);
    await owner.execute(sql`delete from lot where id = ${lotId}`);
    await owner.execute(sql`delete from sale where id = ${saleId}`);
    await owner.execute(sql`delete from collection_storage_terms where id = ${termsId}`);
    await owner.execute(sql`delete from collection_exception where venue_id = ${venueId}`);
    await owner.execute(sql`delete from collection_weekly_hours where venue_id = ${venueId}`);
    await owner.execute(sql`delete from collection_place where venue_id = ${venueId}`);
    await owner.execute(sql`delete from venue where id = ${venueId}`);
    await owner.execute(
      sql`delete from legal_entity where id in (${buyerEntity}, ${sellerEntity})`,
    );
    await owner.execute(sql`delete from "user" where id = ${buyer}`);
  });

  it("finds the lot and its deadline, which a closure after the counted day moves to Thursday", async () => {
    const found = await reader.storedLotsWaiting(window);
    expect(found.map((row) => row.lotId)).toContain(lotId);
    const group = collectByGroups(found, window.today).find((g) =>
      g.lots.some((row) => row.lotId === lotId),
    );
    expect(group).toMatchObject({ kind: "day", collectBy: "2031-03-20" });
  });

  it("prices the lot under the terms recorded on it, reading the storage tables", async () => {
    const found = await reader.storedLotsWaiting(window);
    const row = found.find((r) => r.lotId === lotId);
    expect(row?.storage?.pricing.terms).toMatchObject({ standardDailyPence: 300 });
    expect(row?.storage?.calendar).toBeDefined();
  });

  it("reads without writing: no bank holidays are stored for the place", async () => {
    const stored = await owner.execute(sql`
      select count(*)::int as n from collection_exception
      where venue_id = ${venueId} and source = 'bank_holiday'`);
    expect((stored.rows[0] as { n: number }).n).toBe(0);
  });

  it("takes bank holidays from the domain for a year with none stored, and skips a venue with no place", async () => {
    const calendars = await readCollectByCalendars(
      worker,
      new Map([
        [venueId, { from: "2031-12-20", to: "2032-01-05" }],
        [randomUUID(), { from: "2031-12-20", to: "2032-01-05" }],
      ]),
    );
    expect(calendars.size).toBe(1);
    // Christmas Day 2031 is a Thursday and a bank holiday.
    expect(calendars.get(venueId)?.plan("2031-12-25").kind).toBe("closed");
  });
});
