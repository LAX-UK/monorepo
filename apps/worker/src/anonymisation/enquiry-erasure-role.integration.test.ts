import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  marketingEnquiry,
  marketingEnquiryAttachment,
  marketingEnquiryNote,
  privateSaleEnquiryDetail,
  uploadObject,
} from "@auction/db/schema";
import { ERASED_ENQUIRY } from "@auction/domain";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  });

  afterAll(async () => {
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
