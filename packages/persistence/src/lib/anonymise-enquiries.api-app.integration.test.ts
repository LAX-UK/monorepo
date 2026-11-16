import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  domainEvent,
  enquiryInboundQuarantine,
  marketingEnquiry,
  marketingEnquiryMessage,
} from "@auction/db/schema";
import { ERASED_ENQUIRY } from "@auction/domain";
import { eq, inArray, or } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleEnquiryInboundRepository } from "../repositories/drizzle-enquiry-inbound.repository.js";
import { anonymiseEnquiries } from "./anonymise-enquiries.js";

const OWNER_URL = process.env.DATABASE_URL;
const API_URL = process.env.DATABASE_URL_API;

/**
 * Staff-run enquiry erasure (Data requests › erase enquiries) runs in the Bid API, connected as
 * `api_app`. These run `anonymiseEnquiries` as that role against a database with `db:roles`
 * applied, so a grant that leaves erasure short (such as DELETE on held inbound mail) fails here
 * rather than in front of staff. Rows are seeded and cleaned up as the owner.
 */
describe.skipIf(!OWNER_URL || !API_URL)("enquiry erasure as api_app (integration)", () => {
  async function seed(owner: Database, email: string) {
    const [enquiry] = await owner
      .insert(marketingEnquiry)
      .values({
        topic: "buying",
        intent: "general",
        name: "Ada Lovelace",
        email,
        phone: "+447000000000",
        message: "Is the print still available?",
      } as never)
      .returning({ id: marketingEnquiry.id });
    if (!enquiry) throw new Error("enquiry not created");
    const tag = randomUUID().slice(0, 8);
    const held = (providerMessageId: string, values: Record<string, unknown>) => ({
      providerMessageId,
      reason: "sender_mismatch",
      fromAddress: "someone-else@example.test",
      subject: "Re: your enquiry",
      body: "Held text",
      attachments: [],
      spfResult: "pass",
      dkimResult: "none",
      ...values,
    });
    await owner
      .insert(enquiryInboundQuarantine)
      .values([
        held(`erase-suspect-${tag}`, { suspectedEnquiryId: enquiry.id }),
        held(`erase-address-${tag}`, { reason: "unmatched", fromAddress: email.toUpperCase() }),
        held(`erase-other-${tag}`, { reason: "unmatched" }),
      ] as never);
    await owner.insert(marketingEnquiryMessage).values({
      enquiryId: enquiry.id,
      direction: "inbound",
      providerMessageId: `erase-reply-${tag}`,
      matchedBy: "staff",
      heldReason: "sender_mismatch",
      reviewReason: "Ada's assistant, confirmed by phone",
      fromEmailHash: "hash",
      subject: "Re: your enquiry",
      body: "My reply",
      attachments: [],
      spfResult: "pass",
      dkimResult: "pass",
    } as never);
    return { enquiryId: enquiry.id, tag };
  }

  async function cleanUp(owner: Database, enquiryIds: string[], tag: string) {
    await owner
      .delete(enquiryInboundQuarantine)
      .where(
        inArray(enquiryInboundQuarantine.providerMessageId, [
          `erase-suspect-${tag}`,
          `erase-address-${tag}`,
          `erase-other-${tag}`,
        ]),
      );
    if (enquiryIds.length) {
      await owner
        .delete(marketingEnquiryMessage)
        .where(inArray(marketingEnquiryMessage.enquiryId, enquiryIds));
      await owner.delete(marketingEnquiry).where(inArray(marketingEnquiry.id, enquiryIds));
    }
  }

  it("erases an enquiry by email, including its held mail, as the Bid API's role", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const owner = createDb(OWNER_URL!);
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const api = createDb(API_URL!);
    const email = `erase-api-${randomUUID().slice(0, 8)}@example.test`;
    const { enquiryId, tag } = await seed(owner, email);
    try {
      const counts = await api.transaction((tx) =>
        anonymiseEnquiries(tx as unknown as Database, { kind: "email", email }),
      );
      expect(counts.enquiries).toBe(1);

      const [erased] = await owner
        .select({ name: marketingEnquiry.name, email: marketingEnquiry.email })
        .from(marketingEnquiry)
        .where(eq(marketingEnquiry.id, enquiryId));
      expect(erased).toEqual({ name: ERASED_ENQUIRY.name, email: ERASED_ENQUIRY.email });

      const [reply] = await owner
        .select({
          body: marketingEnquiryMessage.body,
          reviewReason: marketingEnquiryMessage.reviewReason,
          heldReason: marketingEnquiryMessage.heldReason,
        })
        .from(marketingEnquiryMessage)
        .where(eq(marketingEnquiryMessage.enquiryId, enquiryId));
      // The text and the reason staff typed (which can name the sender) go; the code stays.
      expect(reply).toEqual({
        body: ERASED_ENQUIRY.note,
        reviewReason: ERASED_ENQUIRY.note,
        heldReason: "sender_mismatch",
      });

      const left = await owner
        .select({ id: enquiryInboundQuarantine.providerMessageId })
        .from(enquiryInboundQuarantine)
        .where(
          or(
            eq(enquiryInboundQuarantine.providerMessageId, `erase-suspect-${tag}`),
            eq(enquiryInboundQuarantine.providerMessageId, `erase-address-${tag}`),
            eq(enquiryInboundQuarantine.providerMessageId, `erase-other-${tag}`),
          ),
        );
      // The mail suspected to be theirs and the mail from their address are gone; someone
      // else's held mail is untouched.
      expect(left.map((row) => row.id)).toEqual([`erase-other-${tag}`]);
    } finally {
      await cleanUp(owner, [enquiryId], tag);
    }
  });

  it("deletes held mail from the address when no enquiry matches, as the Bid API's role", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const owner = createDb(OWNER_URL!);
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const api = createDb(API_URL!);
    const email = `erase-api-${randomUUID().slice(0, 8)}@example.test`;
    const { enquiryId, tag } = await seed(owner, `${randomUUID().slice(0, 8)}@example.test`);
    await owner
      .update(enquiryInboundQuarantine)
      .set({ fromAddress: email })
      .where(eq(enquiryInboundQuarantine.providerMessageId, `erase-address-${tag}`));
    try {
      const counts = await api.transaction((tx) =>
        anonymiseEnquiries(tx as unknown as Database, { kind: "email", email }),
      );
      expect(counts.enquiries).toBe(0);
      const left = await owner
        .select({ id: enquiryInboundQuarantine.id })
        .from(enquiryInboundQuarantine)
        .where(eq(enquiryInboundQuarantine.providerMessageId, `erase-address-${tag}`));
      expect(left).toHaveLength(0);
    } finally {
      await cleanUp(owner, [enquiryId], tag);
    }
  });
  it("replaces the reason staff typed in the attach and discard events, as the Bid API's role", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const owner = createDb(OWNER_URL!);
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const api = createDb(API_URL!);
    const email = `erase-api-${randomUUID().slice(0, 8)}@example.test`;
    const { enquiryId, tag } = await seed(owner, email);
    const heldRows = await owner
      .select({ id: enquiryInboundQuarantine.id, key: enquiryInboundQuarantine.providerMessageId })
      .from(enquiryInboundQuarantine)
      .where(
        inArray(enquiryInboundQuarantine.providerMessageId, [
          `erase-address-${tag}`,
          `erase-other-${tag}`,
        ]),
      );
    const heldId = (key: string) => heldRows.find((row) => row.key === key)?.id ?? "";
    const fromAddress = heldId(`erase-address-${tag}`);
    const other = heldId(`erase-other-${tag}`);
    const event = (
      aggregateType: string,
      aggregateId: string,
      eventType: string,
      payload: object,
    ) =>
      ({ aggregateType, aggregateId, eventType, payload, producer: "integration_test" }) as const;
    const seeded = await owner
      .insert(domainEvent)
      .values([
        event("marketing_enquiry", enquiryId, "marketing_enquiry.inbound_attached", {
          enquiryId,
          quarantineId: randomUUID(),
          spfResult: "pass",
          reviewReason: "Ada's assistant, confirmed by phone",
        }),
        event("enquiry_inbound_quarantine", fromAddress, "marketing_enquiry.inbound_discarded", {
          quarantineId: fromAddress,
          reason: "unmatched",
          reviewReason: "Ada again, wrong thread",
        }),
        event("enquiry_inbound_quarantine", other, "marketing_enquiry.inbound_discarded", {
          quarantineId: other,
          reason: "unmatched",
          reviewReason: "Newsletter",
        }),
      ])
      .returning({ id: domainEvent.id });
    const ids = seeded.map((row) => row.id);
    try {
      await api.transaction((tx) =>
        anonymiseEnquiries(tx as unknown as Database, { kind: "email", email }),
      );
      const rows = await owner
        .select({ id: domainEvent.id, payload: domainEvent.payload })
        .from(domainEvent)
        .where(inArray(domainEvent.id, ids));
      const [attached, discarded, untouched] = ids.map(
        (id) => rows.find((row) => row.id === id)?.payload as Record<string, unknown>,
      );
      expect(attached).toMatchObject({
        enquiryId,
        spfResult: "pass",
        reviewReason: ERASED_ENQUIRY.note,
      });
      expect(discarded).toEqual({
        quarantineId: fromAddress,
        reason: "unmatched",
        reviewReason: ERASED_ENQUIRY.note,
      });
      // Someone else's held mail, and its event, are untouched.
      expect(untouched).toMatchObject({ reviewReason: "Newsletter" });
    } finally {
      await owner.delete(domainEvent).where(inArray(domainEvent.id, ids));
      await cleanUp(owner, [enquiryId], tag);
    }
  });

  it("makes an attach that locks the enquiry after an erasure began see it erased", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const owner = createDb(OWNER_URL!);
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const api = createDb(API_URL!);
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const attacher = createDb(API_URL!);
    const inbound = new DrizzleEnquiryInboundRepository(attacher);
    const email = `erase-api-${randomUUID().slice(0, 8)}@example.test`;
    const { enquiryId, tag } = await seed(owner, email);
    try {
      let releaseErasure: () => void = () => {};
      const erasureHolds = new Promise<void>((resolve) => {
        releaseErasure = resolve;
      });
      let erasureLocked: () => void = () => {};
      const locked = new Promise<void>((resolve) => {
        erasureLocked = resolve;
      });
      // The erasure takes its locks and keeps its transaction open until told to commit.
      const erasure = api.transaction(async (tx) => {
        await anonymiseEnquiries(tx as unknown as Database, { kind: "email", email });
        erasureLocked();
        await erasureHolds;
      });
      await locked;
      // The attach checked the enquiry before the erasure; now it locks it in its transaction.
      const seen = attacher.transaction(async (tx) =>
        inbound.lockTargetInTransaction(tx as unknown as Database, enquiryId),
      );
      const waited = await Promise.race([
        seen.then(() => "returned"),
        new Promise((resolve) => setTimeout(() => resolve("waiting"), 300)),
      ]);
      // It waits on the erasure's row lock rather than reading the old row.
      expect(waited).toBe("waiting");
      releaseErasure();
      await erasure;
      // Once the erasure commits, the lock returns the erased row, and the attach is refused.
      expect((await seen)?.email).toBe(ERASED_ENQUIRY.email);
    } finally {
      await cleanUp(owner, [enquiryId], tag);
    }
  });
});
