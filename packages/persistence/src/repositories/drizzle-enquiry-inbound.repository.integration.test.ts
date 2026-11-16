import { type Database, createDb } from "@auction/db";
import { emailOutbox, marketingEnquiry, marketingEnquiryMessage } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleEnquiryInboundRepository } from "./drizzle-enquiry-inbound.repository.js";
import { DrizzleMarketingEnquiryRepository } from "./drizzle-marketing-enquiry.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

async function inRollback(run: (tx: Database) => Promise<void>) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDb(databaseUrl);
  const rollback = new Error("rollback_enquiry_inbound_test");
  try {
    await db.transaction(async (tx) => {
      await run(tx as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function newEnquiry(tx: Database) {
  return new DrizzleMarketingEnquiryRepository(tx).createInTransaction(tx, {
    intent: "general",
    topic: "buying",
    name: "Sam Sender",
    email: "sam@example.test",
    message: "Hello",
    marketingOptIn: false,
  });
}

const message = (enquiryId: string, providerMessageId: string) => ({
  enquiryId,
  providerMessageId,
  matchedBy: "token" as const,
  fromEmailHash: "h",
  subject: "Re: hi",
  body: "Thanks",
  attachments: [{ name: "a.jpg", contentType: "image/jpeg", sizeBytes: 10 }],
});

describe.skipIf(!HAS_DB)("DrizzleEnquiryInboundRepository", () => {
  it("stores a reply once per provider message id and marks the thread awaiting a reply", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleEnquiryInboundRepository(tx);
      const enquiry = await newEnquiry(tx);
      await tx
        .update(marketingEnquiry)
        .set({ status: "waiting_on_client" })
        .where(eq(marketingEnquiry.id, enquiry.id));

      expect(await repo.isKnownProviderMessage("pm-1")).toBe(false);
      const first = await repo.insertInboundMessageInTransaction(tx, message(enquiry.id, "pm-1"));
      expect(first?.id).toBeTruthy();
      expect(
        await repo.insertInboundMessageInTransaction(tx, message(enquiry.id, "pm-1")),
      ).toBeNull();
      expect(await repo.isKnownProviderMessage("pm-1")).toBe(true);

      const at = new Date("2026-11-15T10:00:00Z");
      await repo.markAwaitingReplyInTransaction(tx, enquiry.id, at);
      await repo.markAwaitingReplyInTransaction(tx, enquiry.id, new Date("2026-11-16T10:00:00Z"));
      const target = await repo.findTargetById(enquiry.id);
      expect(target?.status).toBe("in_progress");
      const [row] = await tx
        .select()
        .from(marketingEnquiry)
        .where(eq(marketingEnquiry.id, enquiry.id));
      expect(row?.awaitingReplySince).toEqual(at);
      expect(row?.version).toBe(enquiry.version + 2);
    });
  });

  it("holds a message in quarantine once and never on a thread", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleEnquiryInboundRepository(tx);
      const input = {
        providerMessageId: "pm-q",
        reason: "sender_mismatch" as const,
        fromAddress: "evil@attacker.test",
        subject: "s",
        body: "b",
        attachments: [],
      };
      expect((await repo.insertQuarantineInTransaction(tx, input))?.id).toBeTruthy();
      expect(await repo.insertQuarantineInTransaction(tx, input)).toBeNull();
      expect(await repo.isKnownProviderMessage("pm-q")).toBe(true);
      expect(await tx.select().from(marketingEnquiryMessage)).toHaveLength(0);
    });
  });

  it("finds the thread from the provider id of a staff reply", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleEnquiryInboundRepository(tx);
      const enquiry = await newEnquiry(tx);
      const [outbox] = await tx
        .insert(emailOutbox)
        .values({
          idempotencyKey: `test-${Math.random()}`,
          toEmailHash: "h",
          template: "bid-enquiry-received",
          vars: {},
          category: "transactional",
          messageId: "abc-123",
        })
        .returning({ id: emailOutbox.id });
      await tx.insert(marketingEnquiryMessage).values({
        enquiryId: enquiry.id,
        subject: "Re",
        body: "Staff reply",
        outboxId: outbox?.id ?? null,
      });
      expect((await repo.findTargetByOutboundMessageIds(["abc-123"]))?.id).toBe(enquiry.id);
      expect(await repo.findTargetByOutboundMessageIds(["nope"])).toBeNull();
      expect(await repo.findTargetByOutboundMessageIds([])).toBeNull();
    });
  });

  it("refuses an inbound row with no provider message id or an oversized body", async () => {
    await inRollback(async (tx) => {
      const enquiry = await newEnquiry(tx);
      await expect(
        tx.transaction(async (inner) => {
          await inner.insert(marketingEnquiryMessage).values({
            enquiryId: enquiry.id,
            direction: "inbound",
            subject: "s",
            body: "b",
            matchedBy: "token",
          });
        }),
      ).rejects.toThrow();
    });
  });
});
