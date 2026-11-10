import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  collectionBooking,
  collectionBookingLot,
  domainEvent,
  marketingEnquiry,
  marketingEnquiryAttachment,
  marketingEnquiryNote,
  privateSaleEnquiryDetail,
  uploadObject,
} from "@auction/db/schema";
import { ERASED_ENQUIRY } from "@auction/domain";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymiseBidPersonalData } from "./anonymise-bid-personal-data.js";
import { BID_ANONYMISATION_RULES } from "./bid-personal-data-policy.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

class RolledBack extends Error {}

/** Everything the enquiry erasure reads to decide whether an enquiry is held, besides the enquiry. */
const READ_TABLES = [
  "private_sale_deal",
  "private_sale_deal_party",
  "private_sale_deal_party_history",
  "private_sale_deal_stage_history",
  "kyc_watchlist_screening",
  "kyc_verification",
  "source_of_funds",
  "bid_user_profile",
  "domain_events",
];

/**
 * Erasing a person who sent an enquiry, run as `worker_app` against real rows. The probe in
 * bid-anonymisation-role-contract finds no rows for a made-up person and stops after its first
 * read, so it cannot show a missing UPDATE or DELETE. This seeds an enquiry with a note, private
 * sale details and an attached file, runs the rule in a transaction, checks what it did, and rolls
 * the transaction back.
 */
describe.skipIf(!ownerUrl || !workerUrl)("enquiry erasure as worker_app (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const subject = `enq-erase-subject-${run}`;
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const owner = createDb(ownerUrl!);
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const worker = createDb(workerUrl!);
  const rule = BID_ANONYMISATION_RULES.find((r) => r.table === "marketing_enquiry");
  let enquiryId = "";
  let uploadId = "";
  const entityId = randomUUID();
  const venueId = randomUUID();
  let bookingId = "";

  beforeAll(async () => {
    const now = new Date();
    await owner.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${subject}, 'Subject', ${`${subject}@integration.test`}, true, ${now}, ${now})`);
    const [enquiry] = await owner
      .insert(marketingEnquiry)
      .values({
        intent: "private_sale_sell",
        topic: "selling",
        name: "Maya Okafor",
        email: `${subject}@integration.test`,
        phone: "+447700900123",
        message: "I would like to sell a painting.",
        userId: subject,
      })
      .returning({ id: marketingEnquiry.id });
    enquiryId = (enquiry as { id: string }).id;
    await owner
      .insert(marketingEnquiryNote)
      .values({ enquiryId, body: "Called Maya on her mobile" });
    await owner.insert(privateSaleEnquiryDetail).values({
      enquiryId,
      locationTown: "Bath",
      locationCountry: "GB",
      lookingFor: "A valuation",
    });
    const [upload] = await owner
      .insert(uploadObject)
      .values({
        ownerUserId: subject,
        kind: "enquiry_image",
        key: `enquiry/${run}/photo.jpg`,
        declaredContentType: "image/jpeg",
        declaredByteSize: 1000,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      })
      .returning({ id: uploadObject.id });
    uploadId = (upload as { id: string }).id;
    await owner
      .insert(marketingEnquiryAttachment)
      .values({ enquiryId, uploadObjectId: uploadId, kind: "image", position: 0 });

    // A live collection visit on the person's own account, with a lot held for it.
    await owner.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'Subject personal', 'individual', 'private_collector', ${subject}, 'approved')`);
    await owner.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${entityId}, 'Probe gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`);
    const lot = await owner.execute<{ id: string }>(sql`
      insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status)
      values (gen_random_uuid(), ${entityId}::uuid, 'Probe lot', 'english', 100, 100,
         now() - interval '30 days', now() - interval '20 days', 'ended')
      returning id`);
    const [booking] = await owner
      .insert(collectionBooking)
      .values({
        legalEntityId: entityId,
        venueId,
        slotStart: new Date(Date.UTC(2032, 5, 1, 10, 0)),
        slotEnd: new Date(Date.UTC(2032, 5, 1, 10, 30)),
        seat: 1,
        status: "booked",
        bookedByUserId: subject,
        collectorKind: "self",
        collectorName: "Maya Okafor",
        idempotencyKey: randomUUID(),
        requestFingerprint: randomUUID(),
      } as typeof collectionBooking.$inferInsert)
      .returning({ id: collectionBooking.id });
    bookingId = (booking as { id: string }).id;
    await owner
      .insert(collectionBookingLot)
      .values({ bookingId, lotId: (lot.rows[0] as { id: string }).id, active: true });
  });

  afterAll(async () => {
    await owner.execute(
      sql`delete from domain_events where aggregate_type = 'collection_booking' and aggregate_id = ${bookingId}`,
    );
    await owner.execute(
      sql`delete from collection_booking_lot where booking_id = ${bookingId}::uuid`,
    );
    await owner.execute(sql`delete from collection_booking where venue_id = ${venueId}`);
    await owner.execute(sql`delete from lot where seller_legal_entity_id = ${entityId}`);
    await owner.execute(sql`delete from venue where id = ${venueId}`);
    await owner.execute(sql`delete from legal_entity where id = ${entityId}`);
    await owner.delete(marketingEnquiry).where(eq(marketingEnquiry.id, enquiryId));
    await owner.delete(uploadObject).where(eq(uploadObject.id, uploadId));
    await owner.execute(sql`delete from "user" where id = ${subject}`);
  });

  it("replaces the sender's details, the note and the private sale details, and detaches the file", async () => {
    if (!rule) throw new Error("No marketing_enquiry rule in the policy");
    let counts: unknown;
    let seen: Record<string, unknown> = {};
    try {
      await worker.transaction(async (tx) => {
        counts = await rule.apply(tx as never, {
          subjectIds: [subject],
          personalLegalEntityIds: [],
          pseudonym: "Deleted user 7F3A",
        });
        const [row] = await tx
          .select()
          .from(marketingEnquiry)
          .where(eq(marketingEnquiry.id, enquiryId));
        const [note] = await tx
          .select()
          .from(marketingEnquiryNote)
          .where(eq(marketingEnquiryNote.enquiryId, enquiryId));
        const [detail] = await tx
          .select()
          .from(privateSaleEnquiryDetail)
          .where(eq(privateSaleEnquiryDetail.enquiryId, enquiryId));
        const attachments = await tx
          .select()
          .from(marketingEnquiryAttachment)
          .where(eq(marketingEnquiryAttachment.enquiryId, enquiryId));
        const [file] = await tx.select().from(uploadObject).where(eq(uploadObject.id, uploadId));
        seen = { row, note, detail, attachments, file };
        throw new RolledBack();
      });
    } catch (error) {
      if (!(error instanceof RolledBack)) throw error;
    }

    expect(counts).toMatchObject({
      marketing_enquiry: 1,
      marketing_enquiry_note: 1,
      marketing_enquiry_attachment: 1,
    });
    expect(seen.row).toMatchObject({
      name: ERASED_ENQUIRY.name,
      email: ERASED_ENQUIRY.email,
      phone: null,
      message: ERASED_ENQUIRY.message,
      version: 2,
    });
    expect(seen.note).toMatchObject({ body: ERASED_ENQUIRY.note });
    expect(seen.detail).toMatchObject({
      locationTown: null,
      locationCountry: null,
      lookingFor: null,
    });
    expect(seen.attachments).toEqual([]);
    expect((seen.file as { expiresAt: Date }).expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("runs the whole policy for a person with a live visit and an enquiry, as worker_app", async () => {
    let counts: Record<string, number> = {};
    let seen: Record<string, unknown> = {};
    try {
      await worker.transaction(async (tx) => {
        counts = await anonymiseBidPersonalData(tx as never, subject);
        const [row] = await tx
          .select()
          .from(marketingEnquiry)
          .where(eq(marketingEnquiry.id, enquiryId));
        const [visit] = await tx
          .select()
          .from(collectionBooking)
          .where(eq(collectionBooking.id, bookingId));
        const [hold] = await tx
          .select()
          .from(collectionBookingLot)
          .where(eq(collectionBookingLot.bookingId, bookingId));
        const events = await tx
          .select({ eventType: domainEvent.eventType })
          .from(domainEvent)
          .where(eq(domainEvent.aggregateId, bookingId));
        seen = { row, visit, hold, events };
        throw new RolledBack();
      });
    } catch (error) {
      if (!(error instanceof RolledBack)) throw error;
    }
    expect(counts).toMatchObject({
      marketing_enquiry: 1,
      collection_booking_cancelled: 1,
      collection_booking: 1,
    });
    expect(seen.row).toMatchObject({ name: ERASED_ENQUIRY.name });
    expect(seen.visit).toMatchObject({ status: "cancelled", collectorEmail: null });
    expect(seen.hold).toMatchObject({ active: false });
    expect(seen.events).toContainEqual({ eventType: "collection.booking.cancelled" });
  });

  it("leaves the rows as they were once the transaction is rolled back", async () => {
    const [row] = await owner
      .select()
      .from(marketingEnquiry)
      .where(eq(marketingEnquiry.id, enquiryId));
    expect(row).toMatchObject({ name: "Maya Okafor", version: 1 });
  });

  it.each(READ_TABLES)("may read %s, which the held-enquiry check uses", async (table) => {
    let error: unknown = null;
    try {
      await worker.transaction(async (tx) => {
        try {
          await tx.execute(sql`select 1 from ${sql.identifier(table)} limit 0`);
        } catch (e) {
          error = e;
        }
        throw new RolledBack();
      });
    } catch (e) {
      if (!(e instanceof RolledBack)) throw e;
    }
    expect(error).toBeNull();
  });
});
