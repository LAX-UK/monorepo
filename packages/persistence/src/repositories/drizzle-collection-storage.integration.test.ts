import { randomUUID } from "node:crypto";
import { closeDb, createDb } from "@auction/db";
import { collectionPlace } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StorageTermsValues } from "../interfaces/collection-storage.repository.js";
import { DrizzleCollectionStorageRepository } from "./drizzle-collection-storage.repository.js";
import { DrizzleLotFulfilmentRepository } from "./drizzle-lot-fulfilment.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const TODAY = "2031-03-10";
const AT = new Date("2031-03-10T12:00:00Z");

const TERMS: StorageTermsValues = {
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 300,
  largeDailyPence: 600,
  handlingFeePence: 0,
  effectiveFrom: "2031-03-11",
  reason: "First terms",
};

describe.skipIf(!HAS_DB)("collection storage (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const staffId = `col-sto-staff-${run}`;
  const entityId = randomUUID();
  const venueId = randomUUID();
  const emptyVenueId = randomUUID();
  const saleId = randomUUID();
  const lotId = randomUUID();
  const orphanLotId = randomUUID();
  /** Each change is a minute after the last, so the audit has an order. */
  let changes = 0;
  const next = () => ({ actorUserId: staffId, at: new Date(AT.getTime() + ++changes * 60_000) });

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const storage = new DrizzleCollectionStorageRepository(db);

  /**
   * Waits until `count` transactions for the place are blocked: on the terms table (at their
   * insert) or on the place's advisory lock. Fails after 10 seconds rather than hanging. It reads
   * through its own pool: the four calls can take every connection of the shared one.
   */
  async function waitForWaiting(watcher: typeof db, count: number, placeId: string): Promise<void> {
    const key = `collection_place:${placeId}`;
    for (let tries = 0; tries < 400; tries += 1) {
      const result = await watcher.execute(sql`
        select count(*)::int as waiting from pg_locks
        where not granted
          and ((locktype = 'relation' and relation = 'collection_storage_terms'::regclass)
            or (locktype = 'advisory'
              and ((classid::bigint << 32) | objid::bigint) = hashtextextended(${key}, 0)))`);
      const [row] = result.rows as { waiting: number }[];
      if ((row?.waiting ?? 0) >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Fewer than ${count} transactions reached the barrier`);
  }

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${staffId}, 'Staff', ${`${staffId}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into bid_identity_directory (subject_id, email, name, email_verified, identity_created_at)
      values (${staffId}, ${`${staffId}@integration.test`}, 'Storage Finance', true, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'Collection storage IT', 'individual', 'private_collector', ${staffId}, 'approved')`);
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${entityId}, 'Collection storage IT gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB'),
             (${emptyVenueId}, ${entityId}, 'Collection storage IT annexe', '2 Test Street', 'London', 'W1W 6YW', 'GB')`);
    await db.execute(sql`
      insert into sale (id, title, start_time, end_time, venue_id, delivery_mode, status, created_by_legal_entity_id)
      values (${saleId}, 'Collection storage IT sale', '2031-02-01T09:00:00Z', '2031-02-02T16:00:00Z',
         ${venueId}, 'onsite', 'ended', ${entityId})`);
    await db.execute(sql`
      insert into lot (id, seller_legal_entity_id, sale_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status)
      values (${lotId}, ${entityId}, ${saleId}, 'Collection storage IT lot', 'english', 100, 100,
         now() - interval '30 days', now() - interval '20 days', 'ended'),
         (${orphanLotId}, ${entityId}, null, 'Collection storage IT lot without a sale', 'english', 100, 100,
         now() - interval '30 days', now() - interval '20 days', 'ended')`);
    await db.execute(sql`insert into lot_fulfilment (lot_id) values (${lotId})`);
  });

  afterAll(async () => {
    await db.execute(sql`delete from lot_fulfilment where lot_id = ${lotId}`);
    await db.execute(
      sql`delete from collection_storage_audit where venue_id in (${venueId}, ${emptyVenueId})`,
    );
    await db.execute(sql`delete from collection_storage_waiver where lot_id = ${lotId}`);
    await db.execute(sql`delete from collection_storage_extension where lot_id = ${lotId}`);
    await db.execute(
      sql`delete from collection_storage_terms where venue_id in (${venueId}, ${emptyVenueId})`,
    );
    await db.execute(sql`delete from lot where id in (${lotId}, ${orphanLotId})`);
    await db.execute(sql`delete from sale where id = ${saleId}`);
    for (const id of [venueId, emptyVenueId]) {
      await db.execute(sql`delete from collection_weekly_hours where venue_id = ${id}`);
      await db.execute(sql`delete from collection_exception where venue_id = ${id}`);
      await db.delete(collectionPlace).where(eq(collectionPlace.venueId, id));
      await db.execute(sql`delete from venue where id = ${id}`);
    }
    await db.execute(sql`delete from legal_entity where id = ${entityId}`);
    await db.execute(sql`delete from bid_identity_directory where subject_id = ${staffId}`);
    await db.execute(sql`delete from "user" where id = ${staffId}`);
  });

  it("schedules terms and audits who, when, and why", async () => {
    const outcome = await storage.scheduleTerms(venueId, TERMS, TODAY, next());
    expect(outcome.outcome).toBe("scheduled");
    const audit = await storage.listAudit(venueId, 10);
    expect(audit).toEqual([
      expect.objectContaining({
        action: "terms_scheduled",
        actorUserId: staffId,
        actorName: "Storage Finance",
        createdAt: expect.any(Date),
        before: null,
        after: expect.objectContaining({ freeDays: 14, standardDailyPence: 300 }),
        reason: "First terms",
      }),
    ]);
  });

  it("refuses a second live version with the same start date, but allows it once cancelled", async () => {
    expect(await storage.scheduleTerms(venueId, TERMS, TODAY, next())).toEqual({
      outcome: "date_taken",
    });
    const [first] = await storage.listTerms(venueId);
    const cancelled = await storage.cancelScheduledTerms(first?.id ?? "", TODAY, "Mistake", next());
    expect(cancelled.outcome).toBe("saved");
    expect(await storage.listTerms(venueId)).toEqual([]);
    expect((await storage.scheduleTerms(venueId, TERMS, TODAY, next())).outcome).toBe("scheduled");
  });

  it("says when the place is unknown", async () => {
    expect(await storage.scheduleTerms(randomUUID(), TERMS, TODAY, next())).toEqual({
      outcome: "venue_not_found",
    });
  });

  it("edits a version that has not started and records before and after", async () => {
    const [current] = await storage.listTerms(venueId);
    const outcome = await storage.editScheduledTerms(
      current?.id ?? "",
      { ...TERMS, standardDailyPence: 350, largeDailyPence: null, reason: "Raise the rate" },
      TODAY,
      next(),
    );
    expect(outcome.outcome).toBe("saved");
    const [edit] = await storage.listAudit(venueId, 1);
    expect(edit).toMatchObject({
      action: "terms_edited",
      before: expect.objectContaining({ standardDailyPence: 300, largeDailyPence: 600 }),
      after: expect.objectContaining({ standardDailyPence: 350, largeDailyPence: null }),
      reason: "Raise the rate",
    });
  });

  it("will not edit or cancel a version that has started", async () => {
    const [current] = await storage.listTerms(venueId);
    const id = current?.id ?? "";
    expect((await storage.editScheduledTerms(id, TERMS, "2031-03-11", next())).outcome).toBe(
      "not_scheduled",
    );
    expect((await storage.cancelScheduledTerms(id, "2031-03-20", "Late", next())).outcome).toBe(
      "not_scheduled",
    );
    expect((await storage.cancelScheduledTerms(randomUUID(), TODAY, "x", next())).outcome).toBe(
      "not_found",
    );
  });

  it("finds the terms in force on a day: the latest that has started", async () => {
    await storage.scheduleTerms(
      venueId,
      { ...TERMS, effectiveFrom: "2031-06-01", freeDays: 7 },
      "2031-03-11",
      next(),
    );
    expect(await storage.findTermsInForce(venueId, "2031-03-10")).toBeNull();
    expect((await storage.findTermsInForce(venueId, "2031-03-11"))?.freeDays).toBe(14);
    expect((await storage.findTermsInForce(venueId, "2031-05-31"))?.freeDays).toBe(14);
    expect((await storage.findTermsInForce(venueId, "2031-06-01"))?.freeDays).toBe(7);
    expect(await storage.findTermsInForce(emptyVenueId, "2031-06-01")).toBeNull();
  });

  it("will not store terms outside the limits", async () => {
    await expect(
      storage.scheduleTerms(
        venueId,
        { ...TERMS, effectiveFrom: "2031-07-01", freeDays: 91 },
        "2031-06-01",
        next(),
      ),
    ).rejects.toThrow();
    await expect(
      storage.scheduleTerms(
        venueId,
        { ...TERMS, effectiveFrom: "2031-07-01", reason: "  " },
        "2031-06-01",
        next(),
      ),
    ).rejects.toThrow();
  });

  it("keeps charging off, and refuses to switch it on until a VAT treatment is chosen", async () => {
    expect(await storage.setRaiseInvoices(venueId, true, "Go", next())).toEqual({
      outcome: "vat_treatment_required",
    });
    const vat = await storage.setVatTreatment(
      venueId,
      "standard_rated",
      "Accountant confirmed",
      next(),
    );
    expect(vat).toEqual({
      outcome: "saved",
      settings: { raiseInvoices: false, vatTreatment: "standard_rated" },
    });
    const on = await storage.setRaiseInvoices(venueId, true, "Start charging", next());
    expect(on).toEqual({
      outcome: "saved",
      settings: { raiseInvoices: true, vatTreatment: "standard_rated" },
    });
    expect(await storage.findCharging(venueId)).toEqual({
      raiseInvoices: true,
      vatTreatment: "standard_rated",
    });
    const [switched] = await storage.listAudit(venueId, 1);
    expect(switched).toMatchObject({
      action: "charging_switched",
      before: { raiseInvoices: false },
      after: { raiseInvoices: true },
    });
  });

  it("is stopped by the database too: charging on needs a VAT treatment", async () => {
    await expect(
      db.execute(sql`
        update collection_place set raise_storage_invoices = true, storage_vat_treatment = null
        where venue_id = ${venueId}`),
    ).rejects.toThrow();
  });

  it("sets a place up on first charging change", async () => {
    expect(await storage.findCharging(emptyVenueId)).toBeNull();
    expect((await storage.setRaiseInvoices(emptyVenueId, false, "Off", next())).outcome).toBe(
      "saved",
    );
    expect(await storage.findCharging(emptyVenueId)).toEqual({
      raiseInvoices: false,
      vatTreatment: null,
    });
    expect((await storage.setVatTreatment(randomUUID(), "exempt", "x", next())).outcome).toBe(
      "venue_not_found",
    );
  });

  it("marks a work large and back, auditing each change against its place", async () => {
    expect(await storage.setLotLarge(lotId, true, "Frame is 160 cm", next())).toEqual({
      outcome: "saved",
      record: { lotId, large: true },
    });
    const [row] = await db
      .execute<{ storage_large: boolean }>(sql`select storage_large from lot where id = ${lotId}`)
      .then((r) => r.rows);
    expect(row?.storage_large).toBe(true);
    await storage.setLotLarge(lotId, false, null, next());
    const [latest] = await storage.listAudit(venueId, 1);
    expect(latest).toMatchObject({
      action: "large_flag_set",
      lotId,
      before: { large: true },
      after: { large: false },
    });
    expect(await storage.setLotLarge(orphanLotId, true, null, next())).toEqual({
      outcome: "lot_not_found",
    });
  });

  it("records extensions of 1 to 30 days with a reason, and writes an audit row for each", async () => {
    const first = await storage.addExtension(lotId, 7, "Collector abroad", next());
    expect(first.outcome).toBe("saved");
    const [audit] = await storage.listAudit(venueId, 1);
    expect(audit).toMatchObject({
      action: "extension_granted",
      lotId,
      actorUserId: staffId,
      before: { extensionDays: 0 },
      after: { days: 7, extensionDays: 7 },
      reason: "Collector abroad",
    });
    expect((await storage.listExtensions(lotId)).map((e) => e.days)).toEqual([7]);
    expect(await storage.addExtension(lotId, 31, "Too long", next())).toMatchObject({
      outcome: "cap_reached",
    });
    await expect(
      db.execute(sql`
        insert into collection_storage_extension (lot_id, days, reason)
        values (${lotId}, 31, 'Too long for the database too')`),
    ).rejects.toThrow();
    await expect(storage.addExtension(lotId, 0, "None", next())).rejects.toThrow();
    await expect(storage.addExtension(lotId, 5, " ", next())).rejects.toThrow();
    expect(await storage.addExtension(orphanLotId, 5, "x", next())).toEqual({
      outcome: "lot_not_found",
    });
  });

  it("caps a lot's extensions at 30 days in total, not per grant", async () => {
    // 7 days are already given: 23 remain.
    expect(await storage.addExtension(lotId, 24, "One too many", next())).toEqual({
      outcome: "cap_reached",
      daysRemaining: 23,
    });
    expect((await storage.addExtension(lotId, 23, "Up to the cap", next())).outcome).toBe("saved");
    expect(await storage.addExtension(lotId, 1, "Past the cap", next())).toEqual({
      outcome: "cap_reached",
      daysRemaining: 0,
    });
    expect((await storage.listExtensions(lotId)).map((e) => e.days)).toEqual([7, 23]);
  });

  it("cannot pass the cap with grants made at the same time", async () => {
    const racedLot = randomUUID();
    await db.execute(sql`
      insert into lot (id, seller_legal_entity_id, sale_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status)
      values (${racedLot}, ${entityId}, ${saleId}, 'Collection storage IT raced lot', 'english', 100, 100,
         now() - interval '30 days', now() - interval '20 days', 'ended')`);
    try {
      const results = await Promise.all(
        [1, 2, 3, 4].map((n) => storage.addExtension(racedLot, 20, `Grant ${n}`, next())),
      );
      expect(results.filter((r) => r.outcome === "saved")).toHaveLength(1);
      expect(results.filter((r) => r.outcome === "cap_reached")).toHaveLength(3);
      expect((await storage.listExtensions(racedLot)).reduce((sum, e) => sum + e.days, 0)).toBe(20);
    } finally {
      await db.execute(sql`delete from collection_storage_audit where lot_id = ${racedLot}`);
      await db.execute(sql`delete from collection_storage_extension where lot_id = ${racedLot}`);
      await db.execute(sql`delete from lot where id = ${racedLot}`);
    }
  });

  it("waives a lot once, with a reason, and audits it", async () => {
    expect(await storage.findWaiver(lotId)).toBeNull();
    const waived = await storage.addWaiver(lotId, "Goodwill", next());
    expect(waived.outcome).toBe("saved");
    expect(await storage.addWaiver(lotId, "Again", next())).toEqual({ outcome: "already_waived" });
    expect(await storage.findWaiver(lotId)).toMatchObject({ lotId, reason: "Goodwill" });
    const [latest] = await storage.listAudit(venueId, 1);
    expect(latest).toMatchObject({
      action: "waiver_granted",
      lotId,
      actorUserId: staffId,
      before: { waived: false },
      after: { waived: true },
      reason: "Goodwill",
    });
    expect(await storage.addWaiver(orphanLotId, "x", next())).toEqual({ outcome: "lot_not_found" });
  });

  it("adds what the caller saw (the collect-by day, the amount) to the before and after", async () => {
    const detailLot = randomUUID();
    await db.execute(sql`
      insert into lot (id, seller_legal_entity_id, sale_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status)
      values (${detailLot}, ${entityId}, ${saleId}, 'Collection storage IT detail lot', 'english', 100, 100,
         now() - interval '30 days', now() - interval '20 days', 'ended')`);
    try {
      await storage.addExtension(detailLot, 5, "Buyer travelling", next(), {
        before: { collectBy: "2031-03-01" },
        after: { collectBy: "2031-03-06" },
      });
      const [extended] = await storage.listAudit(venueId, 1);
      expect(extended).toMatchObject({
        before: { extensionDays: 0, collectBy: "2031-03-01" },
        after: { extensionDays: 5, days: 5, collectBy: "2031-03-06" },
      });
      await storage.addWaiver(detailLot, "Damaged frame", next(), {
        before: { amountPence: 4200 },
        after: { amountPence: 0 },
      });
      const [waived] = await storage.listAudit(venueId, 1);
      expect(waived).toMatchObject({
        before: { waived: false, amountPence: 4200 },
        after: { waived: true, amountPence: 0 },
      });
    } finally {
      await db.execute(sql`delete from collection_storage_audit where lot_id = ${detailLot}`);
      await db.execute(sql`delete from collection_storage_waiver where lot_id = ${detailLot}`);
      await db.execute(sql`delete from collection_storage_extension where lot_id = ${detailLot}`);
      await db.execute(sql`delete from lot where id = ${detailLot}`);
    }
  });

  it("lists the lots waiting at a place with what prices their storage, oldest first", async () => {
    const buyerId = randomUUID();
    const [waitingOld, waitingNew, handedOver, booked, shipping] = [1, 2, 3, 4, 5].map(() =>
      randomUUID(),
    );
    const all = [waitingOld, waitingNew, handedOver, booked, shipping] as string[];
    const bookingId = randomUUID();
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${buyerId}, 'Waiting Buyer Ltd', 'individual', 'private_collector', ${staffId}, 'approved')`);
    for (const [i, id] of all.entries()) {
      await db.execute(sql`
        insert into lot (id, seller_legal_entity_id, sale_id, title, auction_type, starting_price,
           current_price, start_time, end_time, status, lot_number, buyer_legal_entity_id, storage_large)
        values (${id}, ${entityId}, ${saleId}, ${`Waiting IT lot ${i}`}, 'english', 100, 100,
           now() - interval '30 days', now() - interval '20 days', 'ended', ${100 + i}, ${buyerId}, ${i === 1})`);
    }
    await db.execute(sql`
      insert into lot_fulfilment (lot_id, status, payment_cleared_at, fulfilment_method)
      values (${waitingOld}, 'ready_for_collection', '2031-01-05T10:00:00Z', null),
             (${waitingNew}, 'ready_for_collection', '2031-02-05T10:00:00Z', 'collection'),
             (${handedOver}, 'delivered', '2031-01-05T10:00:00Z', 'collection'),
             (${booked}, 'ready_for_collection', '2031-01-05T10:00:00Z', 'collection'),
             (${shipping}, 'ready_for_collection', '2031-01-05T10:00:00Z', 'shipping')`);
    await db.execute(sql`
      insert into delivery_quote (lot_id, buyer_legal_entity_id, status, destination, requested_at)
      values (${waitingNew}, ${buyerId}, 'requested', 'Somewhere', '2031-02-20T10:00:00Z')`);
    await storage.addWaiver(waitingOld, "Goodwill", next());
    await storage.addExtension(waitingNew, 4, "Travelling", next());
    await db.execute(sql`
      insert into collection_booking (id, reference, legal_entity_id, venue_id, slot_start, slot_end, seat,
         collector_kind, collector_name, idempotency_key, request_fingerprint)
      values (${bookingId}, ${`CB-${bookingId.slice(0, 8)}`}, ${buyerId}, ${venueId}, now() + interval '3 days',
         now() + interval '3 days 30 minutes', 1, 'self', 'Buyer', ${`k-${bookingId}`}, 'f')`);
    await db.execute(sql`
      insert into collection_booking_lot (booking_id, lot_id, active) values (${bookingId}, ${booked}, true)`);
    try {
      const { lots, more } = await storage.waitingLotsAt(venueId, 10, TODAY);
      expect(more).toBe(false);
      expect(lots.map((l) => l.lotId)).toEqual([waitingOld, waitingNew]);
      expect(lots[0]).toMatchObject({
        lotNumber: 100,
        title: "Waiting IT lot 0",
        buyerName: "Waiting Buyer Ltd",
        buyerLegalEntityId: buyerId,
        storage: {
          pricing: { terms: null, large: false, extensionDays: 0, waived: true },
          quote: null,
        },
      });
      expect(lots[0]?.storage.calendar).toBeDefined();
      expect(lots[1]).toMatchObject({
        storage: {
          pricing: { large: true, extensionDays: 4, waived: false },
          quote: { status: "requested" },
        },
      });
      const first = await storage.waitingLotsAt(venueId, 1, TODAY);
      expect(first.lots.map((l) => l.lotId)).toEqual([waitingOld]);
      expect(first.more).toBe(true);
      expect((await storage.waitingLotsAt(emptyVenueId, 10, TODAY)).lots).toEqual([]);
    } finally {
      await db.execute(sql`delete from collection_booking_lot where booking_id = ${bookingId}`);
      await db.execute(sql`delete from collection_booking where id = ${bookingId}`);
      await db.execute(sql`delete from delivery_quote where buyer_legal_entity_id = ${buyerId}`);
      for (const id of all) {
        await db.execute(sql`delete from collection_storage_audit where lot_id = ${id}`);
        await db.execute(sql`delete from collection_storage_waiver where lot_id = ${id}`);
        await db.execute(sql`delete from collection_storage_extension where lot_id = ${id}`);
        await db.execute(sql`delete from lot_fulfilment where lot_id = ${id}`);
        await db.execute(sql`delete from lot where id = ${id}`);
      }
      await db.execute(sql`delete from legal_entity where id = ${buyerId}`);
    }
  });

  it("records the terms in force when the sale closed on its bought lots, once", async () => {
    const [before] = await storage.listTerms(venueId);
    expect(await storage.recordTermsForSale(saleId, "2031-03-10")).toBe(0);
    expect(await storage.recordTermsForSale(saleId, "2031-04-01")).toBe(1);
    const read = () =>
      db
        .execute<{ storage_terms_id: string | null }>(
          sql`select storage_terms_id from lot_fulfilment where lot_id = ${lotId}`,
        )
        .then((r) => r.rows[0]?.storage_terms_id);
    expect(await read()).toBe(before?.id);
    expect(await storage.recordTermsForSale(saleId, "2031-07-01")).toBe(0);
    expect(await read()).toBe(before?.id);
  });

  it("starts terms from tomorrow onward, when scheduling and when editing", async () => {
    const before = (await storage.listTerms(venueId)).length;
    for (const effectiveFrom of [TODAY, "2031-03-01"]) {
      expect(
        await storage.scheduleTerms(venueId, { ...TERMS, effectiveFrom }, TODAY, next()),
      ).toEqual({ outcome: "start_not_in_future" });
    }
    expect(await storage.listTerms(venueId)).toHaveLength(before);
    const scheduled = (await storage.listTerms(venueId)).find(
      (t) => t.effectiveFrom === "2031-06-01",
    );
    for (const effectiveFrom of [TODAY, "2031-03-01"]) {
      expect(
        await storage.editScheduledTerms(
          scheduled?.id ?? "",
          { ...TERMS, effectiveFrom },
          TODAY,
          next(),
        ),
      ).toEqual({ outcome: "start_not_in_future" });
    }
    expect((await storage.findTerms(scheduled?.id ?? ""))?.effectiveFrom).toBe("2031-06-01");
    expect(
      (
        await storage.scheduleTerms(
          venueId,
          { ...TERMS, effectiveFrom: "2031-03-11" },
          TODAY,
          next(),
        )
      ).outcome,
    ).toBe("date_taken");
  });

  it("ignores a cancelled version when finding terms in force, and will not edit it", async () => {
    const future = await storage.scheduleTerms(
      venueId,
      { ...TERMS, effectiveFrom: "2031-09-01", freeDays: 3 },
      "2031-06-01",
      next(),
    );
    const id = future.outcome === "scheduled" ? future.terms.id : "";
    expect((await storage.findTermsInForce(venueId, "2031-09-02"))?.freeDays).toBe(3);
    expect(
      (await storage.cancelScheduledTerms(id, TODAY, "Changed our mind", next())).outcome,
    ).toBe("saved");
    expect((await storage.findTermsInForce(venueId, "2031-09-02"))?.freeDays).toBe(7);
    expect((await storage.editScheduledTerms(id, TERMS, TODAY, next())).outcome).toBe(
      "not_scheduled",
    );
    expect((await storage.cancelScheduledTerms(id, TODAY, "Again", next())).outcome).toBe(
      "not_scheduled",
    );
  });

  it("writes nothing when a switch, VAT treatment or large mark does not change", async () => {
    const count = async () => (await storage.listAudit(venueId, 1000)).length;
    const before = await count();
    expect((await storage.setRaiseInvoices(venueId, true, "Again", next())).outcome).toBe("saved");
    expect(
      (await storage.setVatTreatment(venueId, "standard_rated", "Again", next())).outcome,
    ).toBe("saved");
    expect((await storage.setLotLarge(lotId, false, null, next())).outcome).toBe("saved");
    expect(await count()).toBe(before);
  });

  it("records the terms on a lot whose fulfilment is created after its sale closed", async () => {
    const lateSale = randomUUID();
    const lateLot = randomUUID();
    await db.execute(sql`
      insert into sale (id, title, start_time, end_time, venue_id, delivery_mode, status, created_by_legal_entity_id)
      values (${lateSale}, 'Collection storage IT late sale', '2031-03-30T09:00:00Z', '2031-04-01T16:00:00Z',
         ${venueId}, 'onsite', 'ended', ${entityId})`);
    await db.execute(sql`
      insert into lot (id, seller_legal_entity_id, sale_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status)
      values (${lateLot}, ${entityId}, ${lateSale}, 'Collection storage IT late lot', 'english', 100, 100,
         now() - interval '30 days', now() - interval '20 days', 'ended')`);
    try {
      expect(await storage.recordTermsForSale(lateSale, "2031-04-01")).toBe(0);
      const paymentId = randomUUID();
      await db.execute(sql`
        insert into payment (id, lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id,
           amount, platform_fee, status)
        values (${paymentId}, ${lateLot}, ${staffId}, ${entityId}, ${entityId}, 100, 0, 'captured'::payment_status)`);
      await new DrizzleLotFulfilmentRepository(db).insert({
        lotId: lateLot,
        paymentId,
        status: "awaiting_release",
      });
      const [row] = (
        await db.execute<{ effective_from: string }>(sql`
          select t.effective_from::text from lot_fulfilment lf
          join collection_storage_terms t on t.id = lf.storage_terms_id where lf.lot_id = ${lateLot}`)
      ).rows;
      expect(row?.effective_from).toBe("2031-03-11");
    } finally {
      await db.execute(sql`delete from lot_fulfilment where lot_id = ${lateLot}`);
      await db.execute(sql`delete from payment where lot_id = ${lateLot}`);
      await db.execute(sql`delete from lot where id = ${lateLot}`);
      await db.execute(sql`delete from sale where id = ${lateSale}`);
    }
  });

  it("keeps one change waiting at a time, even when two are sent at the same moment", async () => {
    const racedVenue = randomUUID();
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${racedVenue}, ${entityId}, 'Collection storage IT raced place', '3 Test Street', 'London', 'W1W 6YW', 'GB')`);
    try {
      // A barrier makes the four calls overlap on every run, whatever the pool's state or the
      // order tests run in. A fifth transaction holds a SHARE lock on the terms table: reads go
      // on, inserts wait. Every call that gets as far as its insert has made its checks and now
      // waits there; any other call waits on the place lock. Once all four wait, the barrier
      // lifts. With the place lock, one call is at its insert and three wait their turn, then
      // see its row and refuse. Without it, all four have passed the check and all four insert.
      // The barrier and the watcher have their own pool, so the four calls get a connection each.
      // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
      const side = createDb(process.env.DATABASE_URL!);
      let racing: Promise<Awaited<ReturnType<typeof storage.scheduleTerms>>[]> | undefined;
      try {
        await side.transaction(async (barrier) => {
          await barrier.execute(sql`lock table collection_storage_terms in share mode`);
          racing = Promise.all(
            ["2031-12-01", "2032-01-01", "2032-02-01", "2032-03-01"].map((effectiveFrom) =>
              storage.scheduleTerms(racedVenue, { ...TERMS, effectiveFrom }, TODAY, next()),
            ),
          );
          await waitForWaiting(side, 4, racedVenue);
        });
      } finally {
        await closeDb(side);
      }
      const results = await (racing ?? Promise.resolve([]));
      expect(results.filter((r) => r.outcome === "scheduled")).toHaveLength(1);
      expect(results.filter((r) => r.outcome === "change_already_scheduled")).toHaveLength(3);
      expect(await storage.listTerms(racedVenue)).toHaveLength(1);
      expect(await storage.listAudit(racedVenue, 10)).toHaveLength(1);
      // Once it has started, the next change may wait.
      expect(
        (
          await storage.scheduleTerms(
            racedVenue,
            { ...TERMS, effectiveFrom: "2032-06-01" },
            "2032-05-01",
            next(),
          )
        ).outcome,
      ).toBe("scheduled");
    } finally {
      await db.execute(sql`delete from collection_storage_audit where venue_id = ${racedVenue}`);
      await db.execute(sql`delete from collection_storage_terms where venue_id = ${racedVenue}`);
      await db.execute(sql`delete from collection_place where venue_id = ${racedVenue}`);
      await db.execute(sql`delete from venue where id = ${racedVenue}`);
    }
  });

  it("lists the place's own changes without per-lot rows", async () => {
    const all = await storage.listAudit(venueId, 1000);
    expect(all.some((row) => row.lotId !== null)).toBe(true);
    const place = await storage.listPlaceAudit(venueId, 1000);
    expect(place.length).toBeGreaterThan(0);
    expect(place.every((row) => row.lotId === null)).toBe(true);
    expect(place).toEqual(all.filter((row) => row.lotId === null));
    expect(await storage.listPlaceAudit(venueId, 1)).toHaveLength(1);
  });

  it("lists the audit newest first and limited", async () => {
    const all = await storage.listAudit(venueId, 100);
    const times = all.map((a) => a.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(await storage.listAudit(venueId, 2)).toHaveLength(2);
    expect(await storage.listAudit(randomUUID(), 5)).toEqual([]);
  });
});
