import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { collectionPlace } from "@auction/db/schema";
import { type CollectionWaitFacts, awaitsCollection } from "@auction/domain";
import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectByGroups } from "../services/collect-by-notices.js";
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
  // The lots still waiting on 10 Mar 2031; the storage rules then pick the reminders.
  const window = { today: "2031-03-10" };
  const due = () => reader.storedLotsWaiting(window);
  /** The lots a reminder is due for today: the reader's lots, kept by the domain rule. */
  const remindedToday = async (when = window) =>
    collectByGroups(await reader.storedLotsWaiting(when), when.today).flatMap(
      (group) => group.lots,
    );
  const termsIds: string[] = [];
  /** Records on a lot the terms it was sold under: 14 calendar days free, £3 a day, £6 large. */
  async function soldUnder(lotId: string): Promise<string> {
    const termsId = termsIds[0] ?? randomUUID();
    if (termsIds.length === 0) {
      termsIds.push(termsId);
      await db.execute(sql`
      insert into collection_storage_terms (id, venue_id, free_days, count_mode, standard_daily_pence,
         large_daily_pence, handling_fee_pence, effective_from, reason)
      values (${termsId}, ${venueId}, 14, 'calendar', 300, 600, 0, '2031-01-01', 'Integration terms')`);
    }
    await db.execute(
      sql`update lot_fulfilment set storage_terms_id = ${termsId} where lot_id = ${lotId}`,
    );
    return termsId;
  }

  const extraSales: string[] = [];
  const bookings: string[] = [];
  let lotNumber = 0;
  async function storedLot(
    over: {
      status?: string;
      method?: string | null;
      sale?: string;
      deleted?: boolean;
      saleDeleted?: boolean;
      cleared?: Date | null;
      buyerEntity?: string | null;
    } = {},
  ): Promise<string> {
    const lotId = randomUUID();
    lotNumber += 1;
    let lotSale = over.sale ?? saleId;
    if (over.saleDeleted) {
      lotSale = randomUUID();
      extraSales.push(lotSale);
      await db.execute(sql`
        insert into sale (id, title, start_time, end_time, venue_id, created_by_legal_entity_id, deleted_at)
        values (${lotSale}, 'Deleted sale', now() - interval '30 days', now() - interval '20 days',
           ${venueId}, ${sellerEntity}, now())`);
    }
    const buyerId = over.buyerEntity === undefined ? buyerEntity : over.buyerEntity;
    await db.execute(sql`
      insert into lot (id, seller_legal_entity_id, sale_id, title, lot_number, auction_type,
         starting_price, current_price, start_time, end_time, status, winner_id, buyer_legal_entity_id)
      values (${lotId}, ${sellerEntity}, ${lotSale}, ${`Collect-by lot ${lotNumber}`},
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
    await db.execute(
      sql`update venue set contact_phone = '+44 20 7946 0321' where id = ${venueId}`,
    );
    // Monday to Friday, 10:00 to 19:00.
    await db.execute(sql`
      insert into collection_weekly_hours (venue_id, weekday, opens_local, closes_local)
      select ${venueId}, d, '10:00', '19:00' from generate_series(1, 5) as d`);
  });

  afterAll(async () => {
    await db.execute(sql`
      delete from collection_storage_extension where lot_id in (select id from lot where seller_legal_entity_id = ${sellerEntity})`);
    await db.execute(sql`
      delete from collection_storage_waiver where lot_id in (select id from lot where seller_legal_entity_id = ${sellerEntity})`);
    await db.execute(sql`
      delete from delivery_quote where lot_id in (select id from lot where seller_legal_entity_id = ${sellerEntity})`);
    for (const id of bookings) {
      await db.execute(sql`delete from collection_booking_lot where booking_id = ${id}`);
      await db.execute(sql`delete from collection_booking where id = ${id}`);
    }
    await db.execute(sql`
      delete from lot_fulfilment where lot_id in (select id from lot where seller_legal_entity_id = ${sellerEntity})`);
    await db.execute(sql`delete from lot where seller_legal_entity_id = ${sellerEntity}`);
    await db.execute(
      sql`delete from sale where id in (${saleId}, ${otherSaleId}, ${closedSaleId})`,
    );
    for (const id of extraSales) await db.execute(sql`delete from sale where id = ${id}`);
    for (const id of termsIds) {
      await db.execute(sql`delete from collection_storage_terms where id = ${id}`);
    }
    await db.execute(sql`delete from collection_exception where venue_id = ${venueId}`);
    await db.execute(sql`delete from collection_weekly_hours where venue_id = ${venueId}`);
    await db
      .delete(collectionPlace)
      .where(inArray(collectionPlace.venueId, [venueId, closedVenueId]));
    await db.execute(
      sql`delete from venue where id in (${venueId}, ${otherVenueId}, ${closedVenueId})`,
    );
    await db.execute(sql`delete from legal_entity where id in (${buyerEntity}, ${sellerEntity})`);
    await db.execute(sql`delete from "user" where id = ${buyer}`);
  });

  it("reads a lot waiting at a collection place, with its buyer, place, clearance day and storage", async () => {
    const lotId = await storedLot();
    const found = (await due()).find((row) => row.lotId === lotId);
    expect(found?.storage?.calendar).toBeDefined();
    expect(found).toMatchObject({
      legalEntityId: buyerEntity,
      venueId,
      winnerId: buyer,
      clearedAt,
      storage: {
        // Won before the place had terms: the legacy terms apply (ST9).
        pricing: { terms: null, large: false, extensionDays: 0, waived: false },
        chargingOn: false,
        quote: null,
      },
      place: {
        name: "Collect-by gallery",
        address: "156 New Cavendish Street, London, W1W 6YW",
        phone: "+44 20 7946 0321",
      },
    });
  });

  it("gives each lot its place's calendar, so a deadline on a closed day is the next open day", async () => {
    // Cleared Sat 1 Mar 2031 + 14 days is Sat 15 Mar: the place is shut, so the deadline is Mon 17 Mar.
    const lotId = await storedLot({ cleared: new Date("2031-03-01T10:00:00Z") });
    await soldUnder(lotId);
    const day = { today: "2031-03-17" };
    const groups = collectByGroups(await reader.storedLotsWaiting(day), day.today);
    const group = groups.find((g) => g.lots.some((lot) => lot.lotId === lotId));
    expect(group).toMatchObject({ kind: "day", collectBy: "2031-03-17" });
    // The Saturday itself is no longer the day: nothing is due then.
    const saturday = { today: "2031-03-15" };
    const early = collectByGroups(await reader.storedLotsWaiting(saturday), saturday.today);
    expect(early.find((g) => g.lots.some((lot) => lot.lotId === lotId))?.kind).toBe("lead");
  });

  it("reads the terms a lot was sold under, its band, extensions, waiver, quote and the charging switch", async () => {
    const lotId = await storedLot();
    await soldUnder(lotId);
    await db.execute(sql`update lot set storage_large = true where id = ${lotId}`);
    await db.execute(sql`
      insert into collection_storage_extension (lot_id, days, reason)
      values (${lotId}, 5, 'Buyer abroad'), (${lotId}, 2, 'Buyer abroad')`);
    await db.execute(sql`
      insert into collection_storage_waiver (lot_id, reason) values (${lotId}, 'Gallery error')`);
    await db.execute(sql`
      insert into delivery_quote (lot_id, buyer_legal_entity_id, status, destination, requested_at)
      values (${lotId}, ${buyerEntity}, 'requested', 'Test destination', '2031-03-05T10:00:00Z')`);
    await db.execute(sql`
      update collection_place set raise_storage_invoices = true, storage_vat_treatment = 'standard_rated'
      where venue_id = ${venueId}`);
    const found = (await due()).find((row) => row.lotId === lotId);
    await db.execute(sql`
      update collection_place set raise_storage_invoices = false where venue_id = ${venueId}`);
    expect(found?.storage).toMatchObject({
      pricing: {
        terms: {
          freeDays: 14,
          countMode: "calendar",
          standardDailyPence: 300,
          largeDailyPence: 600,
        },
        large: true,
        extensionDays: 7,
        waived: true,
      },
      chargingOn: true,
      quote: { status: "requested", requestedAt: new Date("2031-03-05T10:00:00Z"), quotedAt: null },
    });
  });

  it("reads a lot long past its day, but not one that cleared after today", async () => {
    const longAgo = await storedLot({ cleared: new Date("2030-06-01T10:00:00Z") });
    const tomorrow = await storedLot({ cleared: new Date("2031-03-11T10:00:00Z") });
    const ids = (await due()).map((row) => row.lotId);
    expect(ids).toContain(longAgo);
    expect(ids).not.toContain(tomorrow);
  });

  it("reads no phone for a venue that has none", async () => {
    await db.execute(sql`update venue set contact_phone = '  ' where id = ${venueId}`);
    const found = (await due()).find((row) => row.venueId === venueId);
    await db.execute(
      sql`update venue set contact_phone = '+44 20 7946 0321' where id = ${venueId}`,
    );
    expect(found?.place.phone).toBeNull();
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

  it("reminds no lot past its day that owes nothing, one with no clearance date, or a place that does not collect", async () => {
    const old = await storedLot({ cleared: new Date("2031-01-01T10:00:00Z") });
    const undated = await storedLot({ cleared: null });
    const elsewhere = await storedLot({ sale: otherSaleId });
    const noOnlineBooking = await storedLot({ sale: closedSaleId });
    const deleted = await storedLot({ deleted: true });
    const ids = (await remindedToday()).map((row) => row.lotId);
    expect(ids).not.toContain(old);
    expect(ids).not.toContain(undated);
    expect(ids).not.toContain(elsewhere);
    expect(ids).not.toContain(noOnlineBooking);
    expect(ids).not.toContain(deleted);
  });

  it("reminds no lot whose day is more than a week away, or long past with nothing owed", async () => {
    const tooRecent = await storedLot({ cleared: new Date("2031-03-08T10:00:00Z") });
    const expired = await storedLot({ cleared: new Date("2031-02-20T10:00:00Z") });
    const ids = (await remindedToday()).map((row) => row.lotId);
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

  describe("lots the buyer can be told they can book", () => {
    const since = new Date("2031-02-15T00:00:00Z");

    it("reads lots paid since the date, whatever their storage deadline, with the same exclusions", async () => {
      const recent = await storedLot({ cleared: new Date("2031-03-08T10:00:00Z") });
      const atStart = await storedLot({ cleared: since });
      const before = await storedLot({ cleared: new Date("2031-02-14T23:59:00Z") });
      const handedOver = await storedLot({
        status: "delivered",
        method: "collection",
        cleared: new Date("2031-03-08T10:00:00Z"),
      });
      const noOnlineBooking = await storedLot({
        sale: closedSaleId,
        cleared: new Date("2031-03-08T10:00:00Z"),
      });
      const undated = await storedLot({ cleared: null });
      const ids = (await reader.lotsClearedSince(since)).map((row) => row.lotId);
      expect(ids).toContain(recent);
      expect(ids).toContain(atStart);
      for (const lotId of [before, handedOver, noOnlineBooking, undated]) {
        expect(ids).not.toContain(lotId);
      }
      expect((await reader.lotsClearedSince(since)).find((r) => r.lotId === recent)).toMatchObject({
        legalEntityId: buyerEntity,
        venueId,
        winnerId: buyer,
        place: { name: "Collect-by gallery" },
      });
    });

    it("counts only earlier emails of the template asked for", async () => {
      const user = `col-can-${run}`;
      const now = new Date();
      await db.execute(sql`
        insert into "user" (id, name, email, email_verified, created_at, updated_at)
        values (${user}, 'C', ${`${user}@integration.test`}, true, ${now}, ${now})`);
      const prefix = `collection-can-book:e:v:${user}:`;
      for (const [suffix, template, lotId] of [
        ["a", "collection-can-book", "l-a"],
        ["b", "collection-collect-by", "l-b"],
      ] as const) {
        await db.execute(sql`
          insert into email_outbox (idempotency_key, user_id, to_email_hash, template, vars, status, stream, category)
          values (${`${prefix}${suffix}`}, ${user}, ${`hash-${user}-${suffix}`}, ${template},
            ${JSON.stringify({ lotIds: [lotId] })}::jsonb, 'sent', 'transactional', 'transactional')`);
      }
      const query = { keyPrefix: prefix, userId: user, today: "2031-03-10" };
      expect(await reader.remindedLotIds({ ...query, template: "collection-can-book" })).toEqual(
        new Set(["l-a"]),
      );
      expect(await reader.remindedLotIds(query)).toEqual(new Set(["l-b"]));
      await db.execute(sql`delete from email_outbox where user_id = ${user}`);
      await db.execute(sql`delete from "user" where id = ${user}`);
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

  it("leaves out exactly the lots the purchase page's awaitsCollection says are not waiting", async () => {
    type Case = Omit<CollectionWaitFacts, "fulfilment"> & {
      status: NonNullable<CollectionWaitFacts["fulfilment"]>["status"];
      method: NonNullable<CollectionWaitFacts["fulfilment"]>["method"];
    };
    const open = { saleDeleted: false, bookingOpen: true, booked: false };
    const cases: Case[] = [
      ...(
        [
          "awaiting_payment",
          "awaiting_release",
          "released",
          "ready_for_collection",
          "in_transit",
          "delivered",
          "cancelled",
        ] as const
      ).flatMap((status) =>
        (["collection", "shipping", null] as const).map((method) => ({ ...open, status, method })),
      ),
      { ...open, status: "ready_for_collection", method: "collection", saleDeleted: true },
      { ...open, status: "ready_for_collection", method: null, bookingOpen: false },
      { ...open, status: "released", method: "collection", booked: true },
    ];
    const lots: { lotId: string; expected: boolean }[] = [];
    for (const c of cases) {
      const lotId = await storedLot({
        status: c.status,
        method: c.method,
        saleDeleted: c.saleDeleted,
        ...(c.bookingOpen ? {} : { sale: closedSaleId }),
      });
      if (c.booked) {
        const bookingId = randomUUID();
        await db.execute(sql`
          insert into collection_booking (id, legal_entity_id, venue_id, slot_start, slot_end,
             seat, status, collector_kind, collector_name, booked_by_user_id, idempotency_key, request_fingerprint)
          values (${bookingId}, ${buyerEntity}, ${venueId}, '2031-03-11T10:00:00Z',
             '2031-03-11T10:30:00Z', 1, 'booked', 'self', 'Buyer', ${buyer}, ${randomUUID()}, ${randomUUID()})`);
        await db.execute(sql`
          insert into collection_booking_lot (booking_id, lot_id, active) values (${bookingId}, ${lotId}, true)`);
        bookings.push(bookingId);
      }
      const { status, method, ...rest } = c;
      lots.push({ lotId, expected: awaitsCollection({ ...rest, fulfilment: { status, method } }) });
    }
    const ids = new Set((await due()).map((row) => row.lotId));
    for (const { lotId, expected } of lots) expect(ids.has(lotId)).toBe(expected);
    expect(lots.some((l) => l.expected)).toBe(true);
  });
});
