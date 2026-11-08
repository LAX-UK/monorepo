import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { collectionBooking } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BID_ANONYMISATION_RULES } from "./bid-personal-data-policy.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("anonymising collection bookings (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const subject = `col-anon-subject-${run}`;
  const other = `col-anon-other-${run}`;
  const entityId = randomUUID();
  const otherEntityId = randomUUID();
  const venueId = randomUUID();
  const pseudonym = "Deleted user 7F3A";
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const rule = BID_ANONYMISATION_RULES.find((r) => r.table === "collection_booking");
  type Scope = Parameters<NonNullable<typeof rule>["apply"]>[1];
  const apply = (scope: Scope) =>
    db.transaction((tx) => {
      if (!rule) throw new Error("No collection_booking rule in the policy");
      return rule.apply(tx as never, scope);
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
        ...over,
      } as typeof collectionBooking.$inferInsert)
      .returning({ id: collectionBooking.id });
    return (row as { id: string }).id;
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
  });

  afterAll(async () => {
    await db.execute(sql`delete from collection_booking where venue_id = ${venueId}`);
    await db.execute(sql`delete from venue where id = ${venueId}`);
    await db.execute(sql`delete from legal_entity where id in (${entityId}, ${otherEntityId})`);
    await db.execute(sql`delete from "user" where id in (${subject}, ${other})`);
  });

  const scope = () => ({
    subjectIds: [subject],
    personalLegalEntityIds: [entityId],
    pseudonym,
  });

  it("scrubs the third party a person named, their own name, and a booking on their account", async () => {
    const asBooker = await booking({
      bookedByUserId: subject,
      collectorKind: "third_party",
      collectorName: "Sam Okoro",
      collectorEmail: "sam@example.com",
      collectorCompany: "Okoro Shipping",
      authorisedByUserId: subject,
      authorisedAt: new Date(),
    });
    const asSelf = await booking({
      bookedByUserId: subject,
      collectorKind: "self",
      collectorName: "Sarah Whitfield",
      collectorEmail: "sarah@example.com",
    });
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
    const unrelated = await booking({
      bookedByUserId: other,
      collectorKind: "third_party",
      collectorName: "Pat Jones",
      collectorEmail: "pat@example.com",
      authorisedByUserId: other,
      authorisedAt: new Date(),
    });

    const changed = await apply(scope());
    expect(changed).toBe(4);

    expect(await read(asBooker)).toMatchObject({
      collectorName: "Deleted collector",
      collectorEmail: null,
      collectorCompany: null,
    });
    for (const id of [asSelf, asCollector, onAccount]) {
      expect(await read(id)).toMatchObject({
        collectorName: pseudonym,
        collectorEmail: null,
        collectorCompany: null,
      });
    }
    expect((await read(asBooker)).personalDetailsErasedAt).toBeInstanceOf(Date);
    // The record of the visit stays; someone else's booking is untouched.
    expect(await read(asBooker)).toMatchObject({
      reference: expect.stringMatching(/^COL-/),
      seat: 1,
    });
    expect(await read(unrelated)).toMatchObject({
      collectorName: "Pat Jones",
      collectorEmail: "pat@example.com",
      personalDetailsErasedAt: null,
    });
  });

  it("changes nothing when run again", async () => {
    const before = await db
      .select({ at: collectionBooking.personalDetailsErasedAt })
      .from(collectionBooking)
      .where(eq(collectionBooking.venueId, venueId));
    const changed = await apply(scope());
    expect(changed).toBe(0);
    const after = await db
      .select({ at: collectionBooking.personalDetailsErasedAt })
      .from(collectionBooking)
      .where(eq(collectionBooking.venueId, venueId));
    expect(after.map((r) => r.at?.getTime())).toEqual(before.map((r) => r.at?.getTime()));
  });

  it("reaches a person with no personal account too", async () => {
    const id = await booking({
      bookedByUserId: subject,
      collectorKind: "third_party",
      collectorName: "Alex Reed",
      collectorEmail: "alex@example.com",
      authorisedByUserId: subject,
      authorisedAt: new Date(),
    });
    const changed = await apply({ subjectIds: [subject], personalLegalEntityIds: [], pseudonym });
    expect(changed).toBe(1);
    expect((await read(id)).collectorName).toBe("Deleted collector");
  });
});
