import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { collectionBooking, emailOutbox } from "@auction/db/schema";
import { emailHash } from "@auction/email";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BID_ANONYMISATION_RULES } from "./bid-personal-data-policy.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * What erasing an account does to the mail queue: rows stay as the record of delivery, but a key
 * made from the raw address and the 30-day recipient snapshot are removed.
 */
describe.skipIf(!HAS_DB)("anonymising the mail queue (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const subject = `outbox-anon-subject-${run}`;
  const other = `outbox-anon-other-${run}`;
  const entityId = randomUUID();
  const otherEntityId = randomUUID();
  const venueId = randomUUID();
  const collectorAddress = `collector-${run}@example.com`;
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const rule = BID_ANONYMISATION_RULES.find((r) => r.table === "email_outbox");
  const apply = () =>
    db.transaction((tx) => {
      if (!rule) throw new Error("No email_outbox rule in the policy");
      return rule.apply(tx as never, {
        subjectIds: [subject],
        personalLegalEntityIds: [entityId],
        pseudonym: "Deleted user 7F3A",
      });
    });
  const ids: string[] = [];

  async function queued(over: Partial<typeof emailOutbox.$inferInsert>): Promise<string> {
    const address = over.toSnapshot ?? `${randomUUID()}@example.com`;
    const [row] = await db
      .insert(emailOutbox)
      .values({
        idempotencyKey: randomUUID(),
        toEmailHash: emailHash(address),
        template: "collection-reminder",
        vars: {},
        category: "transactional",
        status: "sent",
        ...over,
      })
      .returning({ id: emailOutbox.id });
    const id = (row as { id: string }).id;
    ids.push(id);
    return id;
  }

  async function read(id: string) {
    const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id));
    return row as typeof emailOutbox.$inferSelect;
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
      values (${venueId}, ${otherEntityId}, 'Outbox gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`);
  });

  afterAll(async () => {
    if (ids.length > 0) await db.delete(emailOutbox).where(inArray(emailOutbox.id, ids));
    await db.execute(sql`delete from collection_booking where venue_id = ${venueId}`);
    await db.execute(sql`delete from venue where id = ${venueId}`);
    await db.execute(sql`delete from legal_entity where id in (${entityId}, ${otherEntityId})`);
    await db.execute(sql`delete from "user" where id in (${subject}, ${other})`);
  });

  it("replaces a key made from the person's address and drops their snapshot", async () => {
    const id = await queued({
      userId: subject,
      idempotencyKey: `collection-created:7:${subject}@example.com`,
      toSnapshot: `${subject}@example.com`,
      toSnapshotPurgeAt: new Date(Date.now() + 86_400_000),
    });
    expect(await apply()).toBeGreaterThanOrEqual(1);
    const after = await read(id);
    expect(after.idempotencyKey).toBe(`erased:${id}`);
    expect(after.toSnapshot).toBeNull();
    expect(after.toSnapshotPurgeAt).toBeNull();
    expect(after.toEmailHash).toBe(emailHash(`${subject}@example.com`));
    expect(after.status).toBe("sent");
  });

  it("keeps a key that holds no address, and still drops the snapshot", async () => {
    const id = await queued({
      userId: subject,
      idempotencyKey: `collection-created:8:${subject}`,
      toSnapshot: `${subject}@example.com`,
    });
    await apply();
    const after = await read(id);
    expect(after.idempotencyKey).toBe(`collection-created:8:${subject}`);
    expect(after.toSnapshot).toBeNull();
  });

  it("scrubs collection emails to a collector the person named, who has no account", async () => {
    await db.insert(collectionBooking).values({
      legalEntityId: entityId,
      venueId,
      slotStart: new Date("2032-03-01T10:00:00Z"),
      slotEnd: new Date("2032-03-01T10:30:00Z"),
      seat: 1,
      status: "cancelled",
      bookedByUserId: subject,
      collectorKind: "third_party",
      collectorName: "Sam Okoro",
      collectorEmail: collectorAddress,
      idempotencyKey: randomUUID(),
      requestFingerprint: randomUUID(),
    } as typeof collectionBooking.$inferInsert);
    const id = await queued({
      userId: null,
      template: "collection-collector-notice",
      idempotencyKey: `collection-created:7:${collectorAddress}`,
      toEmailHash: emailHash(collectorAddress),
      toSnapshot: collectorAddress,
    });
    await apply();
    const after = await read(id);
    expect(after.idempotencyKey).toBe(`erased:${id}`);
    expect(after.toSnapshot).toBeNull();
  });

  it("leaves other people's rows alone, and changes nothing when run again", async () => {
    const stranger = await queued({
      userId: other,
      idempotencyKey: `collection-created:9:${other}@example.com`,
      toSnapshot: `${other}@example.com`,
    });
    await apply();
    const first = await read(stranger);
    expect(first.idempotencyKey).toBe(`collection-created:9:${other}@example.com`);
    expect(first.toSnapshot).toBe(`${other}@example.com`);
    expect(await apply()).toBe(0);
  });
});
