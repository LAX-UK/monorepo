import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { collectionBooking, collectionBookingLot } from "@auction/db/schema";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleCollectionNoticeReader } from "./drizzle-collection-notice.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/** What the collection emails read: the visit, its place and lots, and who is told. */
describe.skipIf(!HAS_DB)("collection notice reader (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const booker = `col-note-booker-${run}`;
  const owner = `col-note-owner-${run}`;
  const gone = `col-note-gone-${run}`;
  const entityId = randomUUID();
  const venueId = randomUUID();
  const lotIds = [randomUUID(), randomUUID()];
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzleCollectionNoticeReader(db);

  let slot = 0;
  async function visit(over: Record<string, unknown> = {}): Promise<string> {
    slot += 1;
    const start = new Date(Date.UTC(2033, 0, 1, 10, 0) + slot * 30 * 60_000);
    const [row] = await db
      .insert(collectionBooking)
      .values({
        legalEntityId: entityId,
        venueId,
        slotStart: start,
        slotEnd: new Date(start.getTime() + 30 * 60_000),
        seat: 1,
        collectorKind: "self",
        collectorName: "Maya Okafor",
        bookedByUserId: booker,
        idempotencyKey: randomUUID(),
        requestFingerprint: randomUUID(),
        ...over,
      } as typeof collectionBooking.$inferInsert)
      .returning({ id: collectionBooking.id });
    return (row as { id: string }).id;
  }

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${booker}, 'Maya Okafor', ${`${booker}@integration.test`}, true, ${now}, ${now}),
             (${owner}, 'Olu Bello', ${`${owner}@integration.test`}, true, ${now}, ${now}),
             (${gone}, 'Gone Person', ${`${gone}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into bid_identity_directory (subject_id, email, name, email_verified, identity_created_at)
      values (${booker}, ${`${booker}@integration.test`}, 'Maya Okafor', true, now()),
             (${owner}, ${`${owner}@integration.test`}, 'Olu Bello', true, now())`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'Northbank Gallery', 'organisation', 'gallery', ${owner}, 'approved')`);
    await db.execute(sql`
      insert into legal_entity_member (legal_entity_id, user_id, role, is_primary_admin, accepted_at)
      values (${entityId}, ${owner}, 'owner', true, now()),
             (${entityId}, ${booker}, 'buyer_agent', false, now())`);
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${entityId}, 'Notice gallery', '156 New Cavendish Street', 'London', 'W1W 6YW', 'GB')`);
    await db.execute(sql`
      insert into lot (id, seller_legal_entity_id, title, lot_number, auction_type, starting_price,
         current_price, start_time, end_time, status)
      values (${lotIds[0]}, ${entityId}, 'Lowland Storm', 12, 'english', 100, 100,
                now() - interval '30 days', now() - interval '20 days', 'ended'),
             (${lotIds[1]}, ${entityId}, 'Coastal Notation', 14, 'english', 100, 100,
                now() - interval '30 days', now() - interval '20 days', 'ended')`);
  });

  afterAll(async () => {
    await db.execute(sql`
      delete from collection_booking_lot where booking_id in
        (select id from collection_booking where venue_id = ${venueId})`);
    await db.execute(sql`delete from collection_booking where venue_id = ${venueId}`);
    await db.execute(sql`delete from lot where seller_legal_entity_id = ${entityId}`);
    await db.execute(sql`delete from venue where id = ${venueId}`);
    await db.execute(sql`delete from legal_entity_member where legal_entity_id = ${entityId}`);
    await db.execute(sql`delete from legal_entity where id = ${entityId}`);
    await db.execute(
      sql`delete from bid_identity_directory where subject_id in (${booker}, ${owner})`,
    );
    await db.execute(sql`delete from "user" where id in (${booker}, ${owner}, ${gone})`);
  });

  it("reads the visit with its place, its lots in order, the booker and the account's owners", async () => {
    const id = await visit({
      collectorKind: "third_party",
      collectorName: "Sam Okoro",
      collectorEmail: "sam@example.com",
    });
    await db.insert(collectionBookingLot).values([
      { bookingId: id, lotId: lotIds[1] as string, active: true },
      { bookingId: id, lotId: lotIds[0] as string, active: false },
    ]);
    const read = await reader.visit(id);
    expect(read).toMatchObject({
      bookingId: id,
      bookedVia: "client",
      icsSequence: 0,
      collector: { kind: "third_party", name: "Sam Okoro", email: "sam@example.com" },
      place: { name: "Notice gallery", address: "156 New Cavendish Street, London, W1W 6YW" },
      lots: [
        { title: "Lowland Storm", lotNumber: 12, active: false },
        { title: "Coastal Notation", lotNumber: 14, active: true },
      ],
      booker: { userId: booker, email: `${booker}@integration.test`, name: "Maya Okafor" },
    });
    expect(read?.accountPeople.map((p) => p.userId)).toEqual([owner]);
  });

  it("has no booker once that person's account has gone", async () => {
    const id = await visit({ bookedByUserId: gone });
    expect((await reader.visit(id))?.booker).toBeNull();
  });

  it("answers null for a visit that does not exist", async () => {
    expect(await reader.visit(randomUUID())).toBeNull();
  });

  it("finds booked visits in the window made before the cut, and only those", async () => {
    const early = new Date(Date.UTC(2034, 5, 1, 9, 0));
    const inWindow = await visit({
      slotStart: early,
      slotEnd: new Date(early.getTime() + 1_800_000),
      seat: 2,
    });
    await visit({
      slotStart: new Date(early.getTime() + 3_600_000),
      slotEnd: new Date(early.getTime() + 5_400_000),
      status: "cancelled",
    });
    await visit({
      slotStart: new Date(early.getTime() + 7_200_000),
      slotEnd: new Date(early.getTime() + 9_000_000),
      createdAt: new Date(Date.UTC(2034, 5, 1, 12, 0)),
    });
    await visit({
      slotStart: new Date(early.getTime() + 2 * 86_400_000),
      slotEnd: new Date(early.getTime() + 2 * 86_400_000 + 1_800_000),
    });
    const due = await reader.dueReminders({
      from: new Date(Date.UTC(2034, 5, 1, 0, 0)),
      to: new Date(Date.UTC(2034, 5, 2, 0, 0)),
      bookedBefore: new Date(Date.UTC(2034, 5, 1, 10, 0)),
    });
    expect(due).toEqual([{ bookingId: inWindow }]);
  });
});
