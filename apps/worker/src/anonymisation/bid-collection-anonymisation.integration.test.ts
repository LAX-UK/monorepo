import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { collectionBooking, collectionBookingLot, domainEvent } from "@auction/db/schema";
import { DrizzleTransactionRunner } from "@auction/persistence/repositories";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { purgeCollectionHandoverRecords } from "../jobs/purge-collection-handover-records.js";
import { BID_ANONYMISATION_RULES } from "./bid-personal-data-policy.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * What erasing an account does to collection bookings: live visits are cancelled (never
 * scrubbed), ended visits lose the collector's details, and a hand-over keeps the collector's
 * name and ID type until the retention purge clears them.
 */
describe.skipIf(!HAS_DB)("anonymising collection bookings (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const subject = `col-anon-subject-${run}`;
  const other = `col-anon-other-${run}`;
  const entityId = randomUUID();
  const otherEntityId = randomUUID();
  const venueId = randomUUID();
  const pseudonym = "Deleted user 7F3A";
  const lotIds: string[] = [];
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const rule = BID_ANONYMISATION_RULES.find((r) => r.table === "collection_booking");
  type Scope = Parameters<NonNullable<typeof rule>["apply"]>[1];
  const apply = (scope: Scope) =>
    db.transaction((tx) => {
      if (!rule) throw new Error("No collection_booking rule in the policy");
      return rule.apply(tx as never, scope);
    });
  const scope = (): Scope => ({
    subjectIds: [subject],
    personalLegalEntityIds: [entityId],
    pseudonym,
  });

  let slot = 0;
  async function booking(over: Record<string, unknown>): Promise<string> {
    slot += 1;
    const start = new Date(Date.UTC(2032, 0, 1, 10, 0) + slot * 30 * 60_000);
    const [row] = await db
      .insert(collectionBooking)
      .values({
        legalEntityId: otherEntityId,
        venueId,
        slotStart: start,
        slotEnd: new Date(start.getTime() + 30 * 60_000),
        seat: 1,
        collectorKind: "self",
        collectorName: "Someone Else",
        idempotencyKey: randomUUID(),
        requestFingerprint: randomUUID(),
        ...over,
      } as typeof collectionBooking.$inferInsert)
      .returning({ id: collectionBooking.id });
    return (row as { id: string }).id;
  }

  async function holdLot(bookingId: string, active = true): Promise<string> {
    const lotId = lotIds.shift() as string;
    await db.insert(collectionBookingLot).values({ bookingId, lotId, active });
    return lotId;
  }

  async function read(id: string) {
    const [row] = await db.select().from(collectionBooking).where(eq(collectionBooking.id, id));
    return row as typeof collectionBooking.$inferSelect;
  }

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${subject}, 'Subject', ${`${subject}@integration.test`}, true, ${now}, ${now}),
             (${other}, 'Other', ${`${other}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'Subject personal', 'individual', 'private_collector', ${subject}, 'approved'),
             (${otherEntityId}, 'Other personal', 'individual', 'private_collector', ${other}, 'approved')`);
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${otherEntityId}, 'Anon gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`);
    const created = await db.execute<{ id: string }>(sql`
      insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status)
      select gen_random_uuid(), ${otherEntityId}::uuid, 'Anon lot ' || n, 'english', 100, 100,
         now() - interval '30 days', now() - interval '20 days', 'ended'
      from generate_series(1, 20) as n
      returning id`);
    lotIds.push(...created.rows.map((row) => row.id));
  });

  afterAll(async () => {
    await db.execute(sql`
      delete from domain_events where aggregate_type = 'collection_booking'
        and aggregate_id in (select id::text from collection_booking where venue_id = ${venueId})`);
    await db.execute(sql`
      delete from collection_booking_lot where booking_id in
        (select id from collection_booking where venue_id = ${venueId})`);
    await db.execute(sql`delete from collection_booking where venue_id = ${venueId}`);
    await db.execute(sql`delete from lot where seller_legal_entity_id = ${otherEntityId}`);
    await db.execute(sql`delete from venue where id = ${venueId}`);
    await db.execute(sql`delete from legal_entity where id in (${entityId}, ${otherEntityId})`);
    await db.execute(sql`delete from "user" where id in (${subject}, ${other})`);
  });

  describe("a live visit", () => {
    it("is cancelled first, with its lots released and the reason recorded, and only then scrubbed as an ended visit", async () => {
      const live = await booking({
        bookedByUserId: subject,
        collectorKind: "third_party",
        collectorName: "Sam Okoro",
        collectorEmail: "sam@example.com",
        collectorCompany: "Okoro Shipping",
        authorisedByUserId: subject,
        authorisedAt: new Date(),
      });
      const lot = await holdLot(live);
      const before = await read(live);

      const counts = await apply(scope());

      expect(counts).toEqual({ collection_booking_cancelled: 1, collection_booking: 1 });
      const after = await read(live);
      expect(after.status).toBe("cancelled");
      // Cancelled, it is an ended visit with nothing handed over: the collector's details go.
      expect(after).toMatchObject({
        collectorName: "Deleted collector",
        collectorEmail: null,
        collectorCompany: null,
      });
      expect(after.cancelledAt).toBeInstanceOf(Date);
      expect(after.icsSequence).toBe(before.icsSequence + 1);
      const [lotRow] = await db
        .select()
        .from(collectionBookingLot)
        .where(eq(collectionBookingLot.lotId, lot));
      expect(lotRow?.active).toBe(false);

      const events = await db
        .select()
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.aggregateType, "collection_booking"),
            eq(domainEvent.aggregateId, live),
          ),
        );
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: "collection.booking.cancelled",
        producer: "apps/worker",
      });
      expect(events[0]?.payload).toMatchObject({
        bookingId: live,
        cancelledVia: "system",
        reason: "account_erased",
      });
      expect(JSON.stringify(events[0]?.payload)).not.toContain("Sam Okoro");
    });

    it("is cancelled when the person is only named as the collector, or the booking is on their account", async () => {
      const asCollector = await booking({
        bookedByUserId: other,
        collectorKind: "member",
        collectorName: "Sarah Whitfield",
        collectorUserId: subject,
      });
      const onAccount = await booking({
        legalEntityId: entityId,
        bookedByUserId: null,
        bookedVia: "staff",
        collectorKind: "self",
        collectorName: "Sarah Whitfield",
      });
      const counts = await apply(scope());
      expect(counts).toEqual({ collection_booking_cancelled: 2, collection_booking: 2 });
      expect((await read(asCollector)).status).toBe("cancelled");
      expect((await read(onAccount)).status).toBe("cancelled");
      expect((await read(asCollector)).collectorName).toBe(pseudonym);
    });

    it("leaves someone else's live visit alone", async () => {
      const theirs = await booking({
        bookedByUserId: other,
        collectorKind: "third_party",
        collectorName: "Pat Jones",
        collectorEmail: "pat@example.com",
        authorisedByUserId: other,
        authorisedAt: new Date(),
      });
      await apply(scope());
      expect(await read(theirs)).toMatchObject({
        status: "booked",
        collectorName: "Pat Jones",
        collectorEmail: "pat@example.com",
        personalDetailsErasedAt: null,
      });
    });
  });

  describe("an ended visit", () => {
    it("loses the collector's name, email and company when nothing was handed over", async () => {
      const missed = await booking({
        bookedByUserId: subject,
        status: "not_collected",
        collectorKind: "third_party",
        collectorName: "Alex Reed",
        collectorEmail: "alex@example.com",
        collectorCompany: "Reed Art",
        authorisedByUserId: subject,
        authorisedAt: new Date(),
      });
      const cancelledEarlier = await booking({
        bookedByUserId: subject,
        status: "cancelled",
        collectorKind: "self",
        collectorName: "Sarah Whitfield",
        collectorEmail: "sarah@example.com",
      });
      const counts = await apply(scope());
      expect(counts).toMatchObject({ collection_booking: 2, collection_booking_cancelled: 0 });
      expect(await read(missed)).toMatchObject({
        collectorName: "Deleted collector",
        collectorEmail: null,
        collectorCompany: null,
      });
      expect(await read(cancelledEarlier)).toMatchObject({
        collectorName: pseudonym,
        collectorEmail: null,
      });
      expect((await read(missed)).personalDetailsErasedAt).toBeInstanceOf(Date);
    });

    it("keeps the name and ID type of a hand-over, and scrubs the email and company now", async () => {
      const handedOver = await booking({
        bookedByUserId: subject,
        status: "collected",
        collectorKind: "third_party",
        collectorName: "Sam Okoro",
        collectorEmail: "sam@example.com",
        collectorCompany: "Okoro Shipping",
        authorisedByUserId: subject,
        authorisedAt: new Date(),
        idCheckType: "passport",
        outcomeAt: new Date("2031-06-01T11:00:00Z"),
        outcomeByUserId: null,
      });
      const partly = await booking({
        bookedByUserId: subject,
        status: "partly_collected",
        collectorKind: "self",
        collectorName: "Sarah Whitfield",
        collectorEmail: "sarah@example.com",
        idCheckType: "driving_licence",
        outcomeAt: new Date("2031-06-01T12:00:00Z"),
      });
      const counts = await apply(scope());
      expect(counts).toMatchObject({ collection_booking: 2 });
      for (const [id, name, idType] of [
        [handedOver, "Sam Okoro", "passport"],
        [partly, "Sarah Whitfield", "driving_licence"],
      ] as const) {
        expect(await read(id)).toMatchObject({
          collectorName: name,
          idCheckType: idType,
          collectorEmail: null,
          collectorCompany: null,
          handoverRecordClearedAt: null,
        });
        expect((await read(id)).personalDetailsErasedAt).toBeInstanceOf(Date);
      }
    });

    it("changes nothing when run again", async () => {
      const again = await apply(scope());
      expect(again).toEqual({ collection_booking_cancelled: 0, collection_booking: 0 });
    });
  });

  describe("the retention purge", () => {
    const now = new Date("2038-01-01T00:00:00Z");
    const runner = new DrizzleTransactionRunner(db);
    const log = { info: () => undefined };

    async function erasedHandOver(outcomeAt: string, over: Record<string, unknown> = {}) {
      return booking({
        bookedByUserId: other,
        status: "collected",
        collectorKind: "third_party",
        collectorName: "Kept Name",
        collectorEmail: null,
        idCheckType: "passport",
        outcomeAt: new Date(outcomeAt),
        personalDetailsErasedAt: new Date("2031-07-01T00:00:00Z"),
        ...over,
      });
    }

    it("clears the name and ID type once the retention has passed, and not before", async () => {
      const old = await erasedHandOver("2031-06-30T00:00:00Z");
      const recent = await erasedHandOver("2031-07-02T00:00:00Z");

      const first = await purgeCollectionHandoverRecords({
        transactionRunner: runner,
        retentionYears: 6,
        log,
        now: new Date("2037-07-01T00:00:00Z"),
      });
      expect(first.cleared).toBeGreaterThanOrEqual(1);
      expect(await read(old)).toMatchObject({
        collectorName: "Deleted collector",
        idCheckType: null,
      });
      expect((await read(old)).handoverRecordClearedAt).toBeInstanceOf(Date);
      expect(await read(recent)).toMatchObject({
        collectorName: "Kept Name",
        idCheckType: "passport",
        handoverRecordClearedAt: null,
      });

      await purgeCollectionHandoverRecords({
        transactionRunner: runner,
        retentionYears: 6,
        log,
        now,
      });
      expect(await read(recent)).toMatchObject({
        collectorName: "Deleted collector",
        idCheckType: null,
      });
    });

    it("follows the years it is given", async () => {
      const id = await erasedHandOver("2035-01-01T00:00:00Z");
      const at = new Date("2038-01-02T00:00:00Z");
      await purgeCollectionHandoverRecords({
        transactionRunner: runner,
        retentionYears: 6,
        log,
        now: at,
      });
      expect((await read(id)).collectorName).toBe("Kept Name");
      await purgeCollectionHandoverRecords({
        transactionRunner: runner,
        retentionYears: 3,
        log,
        now: at,
      });
      expect((await read(id)).collectorName).toBe("Deleted collector");
    });

    it("never touches a hand-over whose account is open", async () => {
      const open = await erasedHandOver("2020-01-01T00:00:00Z", {
        personalDetailsErasedAt: null,
        collectorEmail: "kept@example.com",
      });
      await purgeCollectionHandoverRecords({
        transactionRunner: runner,
        retentionYears: 3,
        log,
        now,
      });
      expect(await read(open)).toMatchObject({
        collectorName: "Kept Name",
        collectorEmail: "kept@example.com",
        idCheckType: "passport",
      });
    });

    it("leaves a visit that was not handed over alone, and runs again without change", async () => {
      const missed = await erasedHandOver("2020-01-01T00:00:00Z", { status: "not_collected" });
      const second = await purgeCollectionHandoverRecords({
        transactionRunner: runner,
        retentionYears: 3,
        log,
        now,
      });
      expect(await read(missed)).toMatchObject({ collectorName: "Kept Name" });
      const third = await purgeCollectionHandoverRecords({
        transactionRunner: runner,
        retentionYears: 3,
        log,
        now,
      });
      expect(third.cleared).toBe(0);
      expect(second.cleared).toBeGreaterThanOrEqual(0);
    });
  });
});
