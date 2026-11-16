import { type Database, createDb } from "@auction/db";
import {
  enquiryInboundQuarantine,
  marketingEnquiry,
  marketingEnquiryMessage,
  user,
} from "@auction/db/schema";
import { ERASED_ENQUIRY } from "@auction/domain";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  DrizzleEnquiryInboundThreadReader,
  DrizzleEnquiryQuarantineReviewRepository,
} from "./drizzle-enquiry-inbound-review.repository.js";
import { DrizzleEnquiryInboundRepository } from "./drizzle-enquiry-inbound.repository.js";
import { DrizzleMarketingEnquiryRepository } from "./drizzle-marketing-enquiry.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const STAFF = "enquiry-review-staff";
const EVERYONE = { readsGeneral: true, readsPrivateSale: true };

async function inRollback(run: (tx: Database) => Promise<void>) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDb(databaseUrl);
  const rollback = new Error("rollback_enquiry_review_test");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: STAFF,
        email: "enquiry-review-staff@example.test",
        name: "Staff",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      await run(tx as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function newEnquiry(tx: Database, intent: "general" | "private_sale_sell" = "general") {
  return new DrizzleMarketingEnquiryRepository(tx).createInTransaction(tx, {
    intent,
    topic: intent === "general" ? "buying" : "selling",
    name: "Sam Sender",
    email: "sam@example.test",
    message: "Hello",
    marketingOptIn: false,
  });
}

async function hold(
  tx: Database,
  providerMessageId: string,
  suspectedEnquiryId?: string,
  receivedAt = new Date(),
) {
  const created = await new DrizzleEnquiryInboundRepository(tx).insertQuarantineInTransaction(tx, {
    providerMessageId,
    reason: suspectedEnquiryId ? "sender_mismatch" : "unmatched",
    fromAddress: "someone@example.test",
    subject: "Re: your enquiry",
    body: "Plain text",
    attachments: [{ name: "photo.jpg", contentType: "image/jpeg", sizeBytes: 2048 }],
    suspectedEnquiryId,
    spfResult: "pass",
    dkimResult: "none",
  });
  if (!created) throw new Error("not held");
  await tx
    .update(enquiryInboundQuarantine)
    .set({ receivedAt })
    .where(eq(enquiryInboundQuarantine.id, created.id));
  return created.id;
}

describe.skipIf(!HAS_DB)("DrizzleEnquiryQuarantineReviewRepository", () => {
  it("lists pending mail newest first with keyset paging, and the suspected enquiry", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleEnquiryQuarantineReviewRepository(tx);
      const enquiry = await newEnquiry(tx);
      const older = await hold(tx, "rv-1", undefined, new Date("2026-11-10T10:00:00Z"));
      const newer = await hold(tx, "rv-2", enquiry.id, new Date("2026-11-11T10:00:00Z"));

      const first = await repo.list({ scope: EVERYONE, view: "pending", limit: 1 });
      expect(first.map((row) => row.id)).toEqual([newer, older]);
      expect(first[0]?.suspectedEnquiry).toEqual({
        id: enquiry.id,
        reference: enquiry.reference,
        intent: "general",
      });
      expect(first[0]?.attachmentCount).toBe(1);
      const after = first[0] ? { receivedAt: first[0].receivedAt, id: first[0].id } : null;
      const second = await repo.list({ scope: EVERYONE, view: "pending", after, limit: 1 });
      expect(second.map((row) => row.id)).toEqual([older]);
      expect(await repo.countPending(EVERYONE)).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows mail suspected to belong to a private sale enquiry only to private sale readers", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleEnquiryQuarantineReviewRepository(tx);
      const privateSale = await newEnquiry(tx, "private_sale_sell");
      const general = await hold(tx, "rv-g");
      const secret = await hold(tx, "rv-p", privateSale.id);
      const generalOnly = { readsGeneral: true, readsPrivateSale: false };
      const privateOnly = { readsGeneral: false, readsPrivateSale: true };

      const seenByGeneral = (await repo.list({ scope: generalOnly, view: "pending", limit: 50 }))
        .map((row) => row.id)
        .filter((id) => id === general || id === secret);
      expect(seenByGeneral).toEqual([general]);
      expect(await repo.findById(secret, generalOnly)).toBeNull();
      expect((await repo.findById(secret, privateOnly))?.body).toBe("Plain text");
      expect(await repo.findById(general, privateOnly)).toBeNull();
      expect(
        await repo.findById(general, { readsGeneral: false, readsPrivateSale: false }),
      ).toBeNull();
    });
  });

  it("reads mail naming an erased enquiry as unmatched", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleEnquiryQuarantineReviewRepository(tx);
      const enquiry = await newEnquiry(tx);
      const id = await hold(tx, "rv-erased", enquiry.id);
      await tx
        .update(marketingEnquiry)
        .set({ email: ERASED_ENQUIRY.email, name: ERASED_ENQUIRY.name })
        .where(eq(marketingEnquiry.id, enquiry.id));
      expect((await repo.findById(id, EVERYONE))?.suspectedEnquiry).toBeNull();
      expect((await repo.lockInTransaction(tx, id))?.suspectedEnquiry).toBeNull();
      const listed = await repo.list({ scope: EVERYONE, view: "pending", limit: 50 });
      expect(listed.find((row) => row.id === id)?.suspectedEnquiry).toBeNull();
    });
  });

  it("records a review once and moves it to the reviewed view", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleEnquiryQuarantineReviewRepository(tx);
      const id = await hold(tx, "rv-r");
      const at = new Date("2026-11-15T12:00:00Z");
      const locked = await repo.lockInTransaction(tx, id);
      expect(locked?.status).toBe("pending");
      await repo.markReviewedInTransaction(tx, id, { status: "dismissed", byUserId: STAFF, at });
      // A second review never overwrites the first.
      await repo.markReviewedInTransaction(tx, id, { status: "linked", byUserId: STAFF, at });
      const record = await repo.findById(id, EVERYONE);
      expect(record).toMatchObject({
        status: "dismissed",
        reviewedByUserId: STAFF,
        reviewedAt: at,
      });
      const reviewed = await repo.list({ scope: EVERYONE, view: "reviewed", limit: 50 });
      expect(reviewed.some((row) => row.id === id)).toBe(true);
      const pending = await repo.list({ scope: EVERYONE, view: "pending", limit: 50 });
      expect(pending.some((row) => row.id === id)).toBe(false);
    });
  });
});

describe.skipIf(!HAS_DB)("DrizzleEnquiryInboundThreadReader", () => {
  it("lists a thread's emailed replies oldest first with their authentication result", async () => {
    await inRollback(async (tx) => {
      const inbound = new DrizzleEnquiryInboundRepository(tx);
      const enquiry = await newEnquiry(tx);
      for (const [providerMessageId, matchedBy, at] of [
        ["th-2", "staff", "2026-11-15T11:00:00Z"],
        ["th-1", "token", "2026-11-15T10:00:00Z"],
      ] as const) {
        await inbound.insertInboundMessageInTransaction(tx, {
          enquiryId: enquiry.id,
          providerMessageId,
          matchedBy,
          fromEmailHash: "h",
          subject: "Re",
          body: providerMessageId,
          attachments: [],
          spfResult: "pass",
          dkimResult: "pass",
          ...(matchedBy === "staff"
            ? { heldReason: "sender_mismatch", reviewReason: "Confirmed by phone" }
            : {}),
        });
        await tx
          .update(marketingEnquiryMessage)
          .set({ createdAt: new Date(at) })
          .where(eq(marketingEnquiryMessage.providerMessageId, providerMessageId));
      }
      const replies = await new DrizzleEnquiryInboundThreadReader(tx).listInbound(enquiry.id, 50);
      expect(
        replies.map((reply) => [
          reply.body,
          reply.matchedBy,
          reply.spfResult,
          reply.heldReason,
          reply.reviewReason,
          reply.fromEmailHash,
        ]),
      ).toEqual([
        ["th-1", "token", "pass", null, null, "h"],
        ["th-2", "staff", "pass", "sender_mismatch", "Confirmed by phone", "h"],
      ]);
    });
  });

  it("clears the awaiting-reply mark when a change answers the client", async () => {
    await inRollback(async (tx) => {
      const enquiries = new DrizzleMarketingEnquiryRepository(tx);
      const enquiry = await newEnquiry(tx);
      await new DrizzleEnquiryInboundRepository(tx).markAwaitingReplyInTransaction(
        tx,
        enquiry.id,
        new Date("2026-11-15T10:00:00Z"),
      );
      const waiting = await enquiries.findById(enquiry.id);
      expect(waiting?.awaitingReplySince).toEqual(new Date("2026-11-15T10:00:00Z"));
      const updated = await enquiries.updateInTransaction(tx, enquiry.id, waiting?.version ?? 0, {
        status: "waiting_on_client",
        clearsAwaitingReply: true,
      });
      expect(updated?.awaitingReplySince).toBeNull();
      const [row] = await tx
        .select({ since: marketingEnquiry.awaitingReplySince })
        .from(marketingEnquiry)
        .where(eq(marketingEnquiry.id, enquiry.id));
      expect(row?.since).toBeNull();
    });
  });
});

const API_URL = process.env.DATABASE_URL_API;

/** SQLSTATE 42501: the role lacks the privilege (drizzle wraps the driver's error as `cause`). */
async function refusedForPrivilege(query: Promise<unknown>): Promise<boolean> {
  try {
    await query;
    return false;
  } catch (error) {
    const code = (error as { cause?: { code?: string }; code?: string }).cause?.code;
    return (code ?? (error as { code?: string }).code) === "42501";
  }
}

/**
 * The review as `api_app`, the role the Bid API connects with: it may hold mail and change only
 * the review columns, never rewrite what was received. (It may delete held mail, for staff-run
 * erasure; `anonymise-enquiries.api-app.integration.test.ts` covers that path.)
 */
describe.skipIf(!HAS_DB || !API_URL)("enquiry quarantine review as api_app", () => {
  it("holds and reviews mail, and is refused a rewrite of what was received", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const api = createDb(API_URL!);
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const owner = createDb(process.env.DATABASE_URL!);
    const providerMessageId = `api-role-${Date.now()}`;
    try {
      const created = await new DrizzleEnquiryInboundRepository(api).insertQuarantineInTransaction(
        api,
        {
          providerMessageId,
          reason: "unmatched",
          fromAddress: "someone@example.test",
          subject: "S",
          body: "B",
          attachments: [],
          spfResult: "pass",
          dkimResult: "none",
        },
      );
      if (!created) throw new Error("not held");
      const repo = new DrizzleEnquiryQuarantineReviewRepository(api);
      await api.transaction(async (tx) => {
        expect((await repo.lockInTransaction(tx as unknown as Database, created.id))?.status).toBe(
          "pending",
        );
        await repo.markReviewedInTransaction(tx as unknown as Database, created.id, {
          status: "dismissed",
          byUserId: null as never,
          at: new Date(),
        });
      });
      expect((await repo.findById(created.id, EVERYONE))?.status).toBe("dismissed");
      expect(
        await refusedForPrivilege(
          api
            .update(enquiryInboundQuarantine)
            .set({ body: "rewritten" })
            .where(eq(enquiryInboundQuarantine.id, created.id)),
        ),
      ).toBe(true);
    } finally {
      await owner
        .delete(enquiryInboundQuarantine)
        .where(eq(enquiryInboundQuarantine.providerMessageId, providerMessageId));
    }
  });
});
