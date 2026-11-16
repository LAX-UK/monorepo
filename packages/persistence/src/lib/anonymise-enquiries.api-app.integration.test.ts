import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  enquiryInboundQuarantine,
  marketingEnquiry,
  marketingEnquiryMessage,
} from "@auction/db/schema";
import { ERASED_ENQUIRY } from "@auction/domain";
import { eq, inArray, or } from "drizzle-orm";
import { describe, expect, it } from "vitest";
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
      matchedBy: "token",
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
        .select({ body: marketingEnquiryMessage.body })
        .from(marketingEnquiryMessage)
        .where(eq(marketingEnquiryMessage.enquiryId, enquiryId));
      expect(reply?.body).toBe(ERASED_ENQUIRY.note);

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
});
