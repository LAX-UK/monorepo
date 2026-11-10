import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  collectionBooking,
  domainEvent,
  emailEvent,
  emailOutbox,
  notificationOutbox,
} from "@auction/db/schema";
import { emailHash } from "@auction/email";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BID_ANONYMISATION_RULES } from "./bid-personal-data-policy.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/** A booking's calendar entry as the collection emails carry it: both people's addresses. */
const ICS = [
  "BEGIN:VCALENDAR",
  "ATTENDEE;CN=Maya Okafor:mailto:maya@example.com",
  "ATTENDEE;CN=Sam Okoro:mailto:sam@example.com",
  "END:VCALENDAR",
].join("\r\n");

/**
 * What erasing an account does to the mail queue, run as `worker_app` so a missing grant fails
 * here. Rows stay as the record of delivery but lose the recipient: address in the key, snapshot,
 * variables, provider error text, and the provider's reports. Queued mail is stopped except the
 * confirmation of the erasure, and other people's rows are never changed.
 */
describe.skipIf(!ownerUrl || !workerUrl)("anonymising the mail queue (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const subject = `outbox-anon-subject-${run}`;
  const other = `outbox-anon-other-${run}`;
  const entityId = randomUUID();
  const otherEntityId = randomUUID();
  const venueId = randomUUID();
  const subjectAddress = `${subject}@example.com`;
  const otherAddress = `${other}@example.com`;
  const collectorAddress = `collector-${run}@example.com`;
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const owner = createDb(ownerUrl!);
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const worker = createDb(workerUrl!);
  const outboxIds: string[] = [];
  const notificationIds: string[] = [];
  const eventIds: string[] = [];
  let bookingId = "";
  let otherBookingId = "";
  let eventId = 0;

  const rules = ["email_outbox", "notification_outbox"].map((table) => {
    const rule = BID_ANONYMISATION_RULES.find((r) => r.table === table);
    if (!rule) throw new Error(`No ${table} rule in the policy`);
    return rule;
  });
  const apply = () =>
    worker.transaction(async (tx) => {
      const scope = {
        subjectIds: [subject],
        personalLegalEntityIds: [entityId],
        pseudonym: "Deleted user 7F3A",
      };
      const counts: Record<string, unknown> = {};
      for (const rule of rules) counts[rule.table] = await rule.apply(tx as never, scope);
      return counts;
    });

  async function queued(over: Partial<typeof emailOutbox.$inferInsert>): Promise<string> {
    const [row] = await owner
      .insert(emailOutbox)
      .values({
        idempotencyKey: randomUUID(),
        toEmailHash: emailHash(subjectAddress),
        template: "collection-reminder",
        vars: { userName: "Maya", calendar: { content: ICS } },
        category: "transactional",
        status: "sent",
        ...over,
      })
      .returning({ id: emailOutbox.id });
    const id = (row as { id: string }).id;
    outboxIds.push(id);
    return id;
  }

  async function read(id: string) {
    const [row] = await owner.select().from(emailOutbox).where(eq(emailOutbox.id, id));
    return row as typeof emailOutbox.$inferSelect;
  }

  async function booking(by: string, entity: string, slotHour: number): Promise<string> {
    const start = new Date(Date.UTC(2032, 2, 1, slotHour, 0));
    const [row] = await owner
      .insert(collectionBooking)
      .values({
        legalEntityId: entity,
        venueId,
        slotStart: start,
        slotEnd: new Date(start.getTime() + 30 * 60_000),
        seat: 1,
        status: "cancelled",
        bookedByUserId: by,
        collectorKind: "third_party",
        collectorName: "Sam Okoro",
        collectorEmail: collectorAddress,
        idempotencyKey: randomUUID(),
        requestFingerprint: randomUUID(),
      } as typeof collectionBooking.$inferInsert)
      .returning({ id: collectionBooking.id });
    return (row as { id: string }).id;
  }

  beforeAll(async () => {
    const now = new Date();
    await owner.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${subject}, 'Subject', ${subjectAddress}, true, ${now}, ${now}),
             (${other}, 'Other', ${otherAddress}, true, ${now}, ${now})`);
    await owner.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'Subject personal', 'individual', 'private_collector', ${subject}, 'approved'),
             (${otherEntityId}, 'Other personal', 'individual', 'private_collector', ${other}, 'approved')`);
    await owner.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${otherEntityId}, 'Outbox gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`);
    bookingId = await booking(subject, entityId, 10);
    otherBookingId = await booking(other, otherEntityId, 11);
    const [event] = await owner
      .insert(domainEvent)
      .values({
        aggregateType: "collection_booking",
        aggregateId: bookingId,
        eventType: "collection.booking.created",
        payload: {},
        schemaVersion: 1,
        producer: "apps/worker",
      })
      .returning({ id: domainEvent.id });
    eventId = (event as { id: number }).id;
  });

  afterAll(async () => {
    if (eventIds.length > 0) await owner.delete(emailEvent).where(inArray(emailEvent.id, eventIds));
    if (outboxIds.length > 0) {
      await owner.delete(emailEvent).where(inArray(emailEvent.outboxId, outboxIds));
      await owner.delete(emailOutbox).where(inArray(emailOutbox.id, outboxIds));
    }
    if (notificationIds.length > 0) {
      await owner.delete(notificationOutbox).where(inArray(notificationOutbox.id, notificationIds));
    }
    await owner.delete(domainEvent).where(eq(domainEvent.id, eventId));
    await owner.execute(sql`delete from collection_booking where venue_id = ${venueId}`);
    await owner.execute(sql`delete from venue where id = ${venueId}`);
    await owner.execute(sql`delete from legal_entity where id in (${entityId}, ${otherEntityId})`);
    await owner.execute(sql`delete from "user" where id in (${subject}, ${other})`);
  });

  it("clears the key, snapshot, variables, calendar entry and error text of a sent row", async () => {
    const id = await queued({
      userId: subject,
      idempotencyKey: `collection-created:7:${subjectAddress}`,
      toSnapshot: subjectAddress,
      toSnapshotPurgeAt: new Date(Date.now() + 86_400_000),
      lastError: `Found inactive addresses: ${subjectAddress}.`,
    });
    await apply();
    const after = await read(id);
    expect(after.idempotencyKey).toBe(`erased:${id}`);
    expect(after.toSnapshot).toBeNull();
    expect(after.toSnapshotPurgeAt).toBeNull();
    expect(after.vars).toEqual({});
    expect(after.lastError).toBeNull();
    expect(JSON.stringify(after)).not.toContain("example.com");
    expect(after.status).toBe("sent");
  });

  it("keeps a key that holds no address, and still empties the rest", async () => {
    const id = await queued({
      userId: subject,
      idempotencyKey: `collection-created:8:${subject}`,
      toSnapshot: subjectAddress,
    });
    await apply();
    const after = await read(id);
    expect(after.idempotencyKey).toBe(`collection-created:8:${subject}`);
    expect(after.toSnapshot).toBeNull();
    expect(after.vars).toEqual({});
  });

  it("stops queued mail, keeps the confirmation of the erasure, and leaves a row being sent", async () => {
    const pending = await queued({
      userId: subject,
      status: "pending",
      toSnapshot: subjectAddress,
    });
    const confirmation = await queued({
      userId: subject,
      status: "pending",
      template: "account-deletion-completed",
      toSnapshot: subjectAddress,
    });
    const sending = await queued({
      userId: subject,
      status: "sending",
      toSnapshot: subjectAddress,
    });
    await apply();
    expect(await read(pending)).toMatchObject({
      status: "suppressed",
      lastError: "account_erased",
      toSnapshot: null,
      vars: {},
    });
    expect(await read(confirmation)).toMatchObject({
      status: "pending",
      toSnapshot: subjectAddress,
    });
    expect(await read(sending)).toMatchObject({ status: "sending", toSnapshot: subjectAddress });
    const suppressions = await owner.execute(
      sql`select 1 from email_suppression where email_hash = ${emailHash(subjectAddress)}`,
    );
    expect(suppressions.rows).toHaveLength(0);
  });

  it("scrubs mail with no account sent to the person's address, but not the confirmation", async () => {
    await queued({ userId: subject, toSnapshot: subjectAddress });
    const billingCopy = await queued({
      userId: null,
      template: "payment-invoice",
      idempotencyKey: `payment-invoice-billing:le-1:${run}`,
      toSnapshot: subjectAddress,
    });
    const confirmation = await queued({
      userId: null,
      template: "account-deletion-completed",
      toSnapshot: subjectAddress,
    });
    const stranger = await queued({
      userId: null,
      toEmailHash: emailHash(otherAddress),
      toSnapshot: otherAddress,
    });
    await apply();
    expect(await read(billingCopy)).toMatchObject({ toSnapshot: null, vars: {} });
    expect(await read(confirmation)).toMatchObject({ toSnapshot: subjectAddress });
    expect(await read(stranger)).toMatchObject({ toSnapshot: otherAddress });
  });

  it("scrubs a named collector's emails for the person's bookings only", async () => {
    const reminder = await queued({
      userId: null,
      template: "collection-collector-notice",
      idempotencyKey: `collection-reminder:${bookingId}:2032-03-01T10:00:00.000Z:${collectorAddress}`,
      toEmailHash: emailHash(collectorAddress),
      toSnapshot: collectorAddress,
    });
    const event = await queued({
      userId: null,
      template: "collection-cancelled",
      idempotencyKey: `collection-cancelled:${eventId}:${emailHash(collectorAddress)}`,
      toEmailHash: emailHash(collectorAddress),
      toSnapshot: collectorAddress,
    });
    const onSomeoneElsesBooking = await queued({
      userId: null,
      template: "collection-collector-notice",
      idempotencyKey: `collection-reminder:${otherBookingId}:2032-03-01T11:00:00.000Z:${collectorAddress}`,
      toEmailHash: emailHash(collectorAddress),
      toSnapshot: collectorAddress,
    });
    const hasAnAccount = await queued({
      userId: other,
      template: "collection-collector-notice",
      idempotencyKey: `collection-reminder:${bookingId}:2032-03-01T10:00:00.000Z:${other}`,
      toEmailHash: emailHash(collectorAddress),
      toSnapshot: collectorAddress,
    });
    await apply();
    expect(await read(reminder)).toMatchObject({
      idempotencyKey: `erased:${reminder}`,
      toSnapshot: null,
    });
    expect(await read(event)).toMatchObject({ toSnapshot: null, vars: {} });
    expect(await read(onSomeoneElsesBooking)).toMatchObject({ toSnapshot: collectorAddress });
    expect(await read(hasAnAccount)).toMatchObject({ toSnapshot: collectorAddress });
  });

  it("empties the provider's reports for the person's messages and no others", async () => {
    const mine = await queued({ userId: subject, messageId: `msg-${run}-1` });
    const theirs = await queued({ userId: other, messageId: `msg-${run}-2` });
    const report = { Recipient: subjectAddress, Content: `bounce for ${subjectAddress}` };
    await owner.insert(emailEvent).values([
      { outboxId: mine, messageId: `msg-${run}-1`, type: "bounce", payload: report },
      { outboxId: theirs, messageId: `msg-${run}-2`, type: "bounce", payload: report },
    ]);
    await apply();
    const events = await owner
      .select({ outboxId: emailEvent.outboxId, payload: emailEvent.payload })
      .from(emailEvent)
      .where(inArray(emailEvent.outboxId, [mine, theirs]));
    expect(events.find((e) => e.outboxId === mine)?.payload).toEqual({});
    expect(events.find((e) => e.outboxId === theirs)?.payload).toEqual(report);
  });

  it("empties the reports of a collector's old-key row, which the provider links by message id only", async () => {
    const old = await queued({
      userId: null,
      template: "collection-collector-notice",
      idempotencyKey: `collection-reminder:${bookingId}:2032-03-01T12:00:00.000Z:${collectorAddress}`,
      toEmailHash: emailHash(collectorAddress),
      messageId: `msg-${run}-collector`,
    });
    const report = { Recipient: collectorAddress, Content: `bounce for ${collectorAddress}` };
    const [event] = await owner
      .insert(emailEvent)
      .values({
        outboxId: null,
        messageId: `msg-${run}-collector`,
        type: "bounce",
        payload: report,
      })
      .returning({ id: emailEvent.id });
    eventIds.push((event as { id: string }).id);
    await apply();
    expect(await read(old)).toMatchObject({ idempotencyKey: `erased:${old}` });
    const [after] = await owner
      .select({ payload: emailEvent.payload })
      .from(emailEvent)
      .where(eq(emailEvent.id, (event as { id: string }).id));
    expect(after?.payload).toEqual({});
  });

  it("empties dispatched notifications and leaves waiting ones", async () => {
    const [sent, waiting] = await owner
      .insert(notificationOutbox)
      .values([
        {
          idempotencyKey: `n-sent-${run}`,
          userId: subject,
          payload: { title: "Sam asked" },
          state: "sent",
        },
        {
          idempotencyKey: `n-wait-${run}`,
          userId: subject,
          payload: { title: "Sam asked" },
          state: "pending",
        },
      ])
      .returning({ id: notificationOutbox.id, state: notificationOutbox.state });
    notificationIds.push((sent as { id: string }).id, (waiting as { id: string }).id);
    await apply();
    const rows = await owner
      .select({ state: notificationOutbox.state, payload: notificationOutbox.payload })
      .from(notificationOutbox)
      .where(inArray(notificationOutbox.id, notificationIds));
    expect(rows.find((r) => r.state === "sent")?.payload).toEqual({});
    expect(rows.find((r) => r.state === "pending")?.payload).toEqual({ title: "Sam asked" });
  });

  it("leaves other people's rows alone, and changes nothing when run again", async () => {
    const stranger = await queued({
      userId: other,
      idempotencyKey: `collection-created:9:${otherAddress}`,
      toEmailHash: emailHash(otherAddress),
      toSnapshot: otherAddress,
    });
    await apply();
    expect(await read(stranger)).toMatchObject({
      idempotencyKey: `collection-created:9:${otherAddress}`,
      toSnapshot: otherAddress,
    });
    expect(await apply()).toEqual({
      email_outbox: { email_outbox: 0, email_event: 0 },
      notification_outbox: 0,
    });
  });
});
