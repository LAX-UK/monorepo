import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { collectionPlace } from "@auction/db/schema";
import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleCollectByReader } from "./drizzle-collect-by.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/** Which purchased lots are still waiting at a place that collects, and when they cleared. */
describe.skipIf(!HAS_DB)("collect-by reader (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const buyer = `col-by-buyer-${run}`;
  const buyerEntity = randomUUID();
  const sellerEntity = randomUUID();
  const venueId = randomUUID();
  const otherVenueId = randomUUID();
  const saleId = randomUUID();
  const otherSaleId = randomUUID();
  const closedVenueId = randomUUID();
  const closedSaleId = randomUUID();
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzleCollectByReader(db);
  const clearedAt = new Date("2031-03-01T10:00:00Z");
  // A reminder is due on 10 Mar 2031 for lots that cleared from 24 Feb (the 14-day free period
  // ago) to 3 Mar (a week less): the lot cleared 1 Mar is in range, one cleared 1 Jan is not.
  const window = { today: "2031-03-10", defaultFreeStorageDays: 30, reminderLeadDays: 7 };
  const due = () => reader.storedLotsDue(window);

  let lotNumber = 0;
  async function storedLot(
    over: {
      status?: string;
      method?: string | null;
      sale?: string;
      deleted?: boolean;
      cleared?: Date | null;
      buyerEntity?: string | null;
    } = {},
  ): Promise<string> {
    const lotId = randomUUID();
    lotNumber += 1;
    const buyerId = over.buyerEntity === undefined ? buyerEntity : over.buyerEntity;
    await db.execute(sql`
      insert into lot (id, seller_legal_entity_id, sale_id, title, lot_number, auction_type,
         starting_price, current_price, start_time, end_time, status, winner_id, buyer_legal_entity_id)
      values (${lotId}, ${sellerEntity}, ${over.sale ?? saleId}, ${`Collect-by lot ${lotNumber}`},
         ${lotNumber}, 'english', 100, 100, now() - interval '40 days', now() - interval '20 days',
         'ended', ${buyer}, ${buyerId})`);
    if (over.deleted) await db.execute(sql`update lot set deleted_at = now() where id = ${lotId}`);
    const cleared = over.cleared === undefined ? clearedAt : over.cleared;
    await db.execute(sql`
      insert into lot_fulfilment (lot_id, status, fulfilment_method, payment_cleared_at)
      values (${lotId}, ${over.status ?? "awaiting_release"}::lot_fulfilment_status,
         ${over.method ?? null}::lot_fulfilment_method, ${cleared})`);
    return lotId;
  }

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${buyer}, 'Buyer', ${`${buyer}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${buyerEntity}, 'Collect-by buyer', 'individual', 'private_collector', ${buyer}, 'approved'),
             (${sellerEntity}, 'Collect-by seller', 'organisation', 'gallery', ${buyer}, 'approved')`);
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${sellerEntity}, 'Collect-by gallery', '156 New Cavendish Street', 'London', 'W1W 6YW', 'GB'),
             (${otherVenueId}, ${sellerEntity}, 'No collections here', '1 Test Street', 'London', 'W1W 6YW', 'GB'),
             (${closedVenueId}, ${sellerEntity}, 'Online booking off', '2 Test Street', 'London', 'W1W 6YW', 'GB')`);
    await db.execute(sql`
      insert into sale (id, title, start_time, end_time, venue_id, created_by_legal_entity_id)
      values (${saleId}, 'Collect-by sale', now() - interval '30 days', now() - interval '20 days', ${venueId}, ${sellerEntity}),
             (${otherSaleId}, 'Elsewhere sale', now() - interval '30 days', now() - interval '20 days', ${otherVenueId}, ${sellerEntity}),
             (${closedSaleId}, 'Closed sale', now() - interval '30 days', now() - interval '20 days', ${closedVenueId}, ${sellerEntity})`);
    await db.execute(sql`
      insert into collection_place (venue_id, free_storage_days, online_booking_enabled)
      values (${venueId}, 14, true), (${closedVenueId}, 14, false)`);
  });

  afterAll(async () => {
    await db.execute(sql`
      delete from lot_fulfilment where lot_id in (select id from lot where seller_legal_entity_id = ${sellerEntity})`);
    await db.execute(sql`delete from lot where seller_legal_entity_id = ${sellerEntity}`);
    await db.execute(
      sql`delete from sale where id in (${saleId}, ${otherSaleId}, ${closedSaleId})`,
    );
    await db
      .delete(collectionPlace)
      .where(inArray(collectionPlace.venueId, [venueId, closedVenueId]));
    await db.execute(
      sql`delete from venue where id in (${venueId}, ${otherVenueId}, ${closedVenueId})`,
    );
    await db.execute(sql`delete from legal_entity where id in (${buyerEntity}, ${sellerEntity})`);
    await db.execute(sql`delete from "user" where id = ${buyer}`);
  });

  it("reads a lot waiting at a collection place, with its buyer, place, clearance day and free period", async () => {
    const lotId = await storedLot();
    const found = (await due()).find((row) => row.lotId === lotId);
    expect(found).toMatchObject({
      legalEntityId: buyerEntity,
      venueId,
      winnerId: buyer,
      clearedAt,
      freeStorageDays: 14,
      place: { name: "Collect-by gallery", address: "156 New Cavendish Street, London, W1W 6YW" },
    });
  });

  it("leaves out what is handed over, cancelled, on its way, going by courier, or not paid yet", async () => {
    const skipped = [
      await storedLot({ status: "delivered", method: "collection" }),
      await storedLot({ status: "cancelled" }),
      await storedLot({ status: "in_transit" }),
      await storedLot({ status: "released", method: "shipping" }),
      await storedLot({ status: "awaiting_payment" }),
    ];
    const ids = (await due()).map((row) => row.lotId);
    for (const lotId of skipped) expect(ids).not.toContain(lotId);
  });

  it("leaves out a lot that cleared before the look-back, one with no clearance date, and a place that does not collect", async () => {
    const old = await storedLot({ cleared: new Date("2031-01-01T10:00:00Z") });
    const undated = await storedLot({ cleared: null });
    const elsewhere = await storedLot({ sale: otherSaleId });
    const noOnlineBooking = await storedLot({ sale: closedSaleId });
    const deleted = await storedLot({ deleted: true });
    const ids = (await due()).map((row) => row.lotId);
    expect(ids).not.toContain(old);
    expect(ids).not.toContain(undated);
    expect(ids).not.toContain(elsewhere);
    expect(ids).not.toContain(noOnlineBooking);
    expect(ids).not.toContain(deleted);
  });

  it("leaves out a lot that cleared too late for a reminder yet, or took longer than its free period", async () => {
    const tooRecent = await storedLot({ cleared: new Date("2031-03-08T10:00:00Z") });
    const expired = await storedLot({ cleared: new Date("2031-02-20T10:00:00Z") });
    const ids = (await due()).map((row) => row.lotId);
    expect(ids).not.toContain(tooRecent);
    expect(ids).not.toContain(expired);
  });

  describe("which lots earlier reminders covered", () => {
    const user = `col-by-user-${run}`;
    const other = `col-by-other-${run}`;
    const prefix = `collection-collect-by:lead:e:v:2031-03-15:${user}:`;
    const today = "2031-03-10";

    async function outboxRow(
      key: string,
      userId: string,
      status: string,
      lotIds: string[],
      createdAt: string,
    ) {
      await db.execute(sql`
        insert into email_outbox (idempotency_key, user_id, to_email_hash, template, vars, status, stream, category, created_at)
        values (${key}, ${userId}, ${`hash-${key}`}, 'collection-collect-by', ${JSON.stringify({ lotIds })}::jsonb,
          ${status}, 'transactional', 'transactional', ${createdAt}::timestamptz)`);
    }

    beforeAll(async () => {
      const now = new Date();
      await db.execute(sql`
        insert into "user" (id, name, email, email_verified, created_at, updated_at)
        values (${user}, 'U', ${`${user}@integration.test`}, true, ${now}, ${now}),
               (${other}, 'O', ${`${other}@integration.test`}, true, ${now}, ${now})`);
    });

    afterAll(async () => {
      await db.execute(sql`delete from email_outbox where user_id in (${user}, ${other})`);
      await db.execute(sql`delete from "user" where id in (${user}, ${other})`);
    });

    it("counts queued, sent and suppressed rows with the prefix, whenever they were made", async () => {
      await outboxRow(`${prefix}aaa`, user, "sent", ["l-1", "l-2"], "2031-03-08T10:00:00Z");
      await outboxRow(`${prefix}bbb`, user, "suppressed", ["l-3"], "2031-03-08T10:00:00Z");
      await outboxRow(`${prefix}ccc`, user, "pending", ["l-4"], "2031-03-10T09:00:00Z");
      expect(await reader.remindedLotIds({ keyPrefix: prefix, userId: user, today })).toEqual(
        new Set(["l-1", "l-2", "l-3", "l-4"]),
      );
    });

    it("counts a failed row made today, but not one from an earlier London day, so it is retried once a day", async () => {
      await outboxRow(`${prefix}fff`, user, "failed", ["l-5"], "2031-03-09T10:00:00Z");
      await outboxRow(`${prefix}ggg`, user, "failed", ["l-6"], "2031-03-10T09:00:00Z");
      const covered = await reader.remindedLotIds({ keyPrefix: prefix, userId: user, today });
      expect(covered.has("l-5")).toBe(false);
      expect(covered.has("l-6")).toBe(true);
    });

    it("takes the London day of a failed row, not the UTC day", async () => {
      // 23:30 UTC on 9 Mar is still the 9th in London in winter; 00:30 BST on 10 Jun is the 10th.
      await outboxRow(`${prefix}hhh`, user, "failed", ["l-7"], "2031-03-09T23:30:00Z");
      expect(
        (await reader.remindedLotIds({ keyPrefix: prefix, userId: user, today })).has("l-7"),
      ).toBe(false);
      await outboxRow(`${prefix}iii`, user, "failed", ["l-8"], "2031-06-09T23:30:00Z");
      expect(
        (await reader.remindedLotIds({ keyPrefix: prefix, userId: user, today: "2031-06-10" })).has(
          "l-8",
        ),
      ).toBe(true);
    });

    it("looks only at the person's own rows and the prefix", async () => {
      await outboxRow(`${prefix}jjj`, other, "sent", ["l-9"], "2031-03-08T10:00:00Z");
      await outboxRow(
        `collection-collect-by:lead:e:v:2031-03-16:${user}:kkk`,
        user,
        "sent",
        ["l-10"],
        "2031-03-08T10:00:00Z",
      );
      const covered = await reader.remindedLotIds({ keyPrefix: prefix, userId: user, today });
      expect(covered.has("l-9")).toBe(false);
      expect(covered.has("l-10")).toBe(false);
      expect(
        await reader.remindedLotIds({ keyPrefix: `${prefix}nope:`, userId: user, today }),
      ).toEqual(new Set());
    });
  });

  it("leaves out a lot already in a live booking", async () => {
    const booked = await storedLot();
    const bookingId = randomUUID();
    await db.execute(sql`
      insert into collection_booking (id, legal_entity_id, venue_id, slot_start, slot_end,
         seat, status, collector_kind, collector_name, booked_by_user_id, idempotency_key, request_fingerprint)
      values (${bookingId}, ${buyerEntity}, ${venueId}, '2031-03-10T10:00:00Z',
         '2031-03-10T10:30:00Z', 1, 'booked', 'self', 'Buyer', ${buyer}, ${randomUUID()}, ${randomUUID()})`);
    await db.execute(sql`
      insert into collection_booking_lot (booking_id, lot_id, active) values (${bookingId}, ${booked}, true)`);
    const ids = (await due()).map((row) => row.lotId);
    expect(ids).not.toContain(booked);
    await db.execute(sql`delete from collection_booking_lot where booking_id = ${bookingId}`);
    await db.execute(sql`delete from collection_booking where id = ${bookingId}`);
  });
});
