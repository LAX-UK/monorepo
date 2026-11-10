import { createDb } from "@auction/db";
import { emailOutbox } from "@auction/db/schema";
import { PostmarkEmailService } from "@auction/email";
import { eq, sql } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DrizzleEmailOutboxRepository } from "../repositories/drizzle-email-outbox.repository.js";
import { sendEmailUseCase } from "../services/send-email.use-case.js";
import { enqueueStaleEmailOutboxRows } from "./send-email.js";

const ownerUrl = process.env.DATABASE_URL;
// The worker's own role where the role job provides it, so a missing grant fails here.
const workerUrl = process.env.DATABASE_URL_WORKER ?? ownerUrl;

describe.skipIf(!ownerUrl)(
  "an email queued in a transaction is sent, and retried when a send fails (integration)",
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by ownerUrl
    const owner = createDb(ownerUrl!);
    // biome-ignore lint/style/noNonNullAssertion: gated by ownerUrl
    const outboxRepo = new DrizzleEmailOutboxRepository(createDb(workerUrl!));
    const suffix = Math.random().toString(36).slice(2, 10);
    const userId = `queued-email-${suffix}`;
    const address = `${userId}@integration.test`;
    const idempotencyKey = `kyc-declined:${userId}:session-${suffix}:none`;
    const log = pino({ level: "silent" });

    const row = async () =>
      (
        await owner.select().from(emailOutbox).where(eq(emailOutbox.idempotencyKey, idempotencyKey))
      )[0];

    async function queueDecisionEmail() {
      // The queue is not used inside a transaction: the drain below is what puts the job on it.
      const service = new PostmarkEmailService(owner, { add: vi.fn() });
      return owner.transaction((tx) =>
        service.enqueueInTransaction(tx, {
          template: "kyc-declined",
          to: address,
          userId,
          category: "transactional",
          vars: {
            userName: "Ada",
            retryUrl: "https://lax.bid/verify-identity",
            contactUrl: "https://lax.bid/contact",
          },
          idempotencyKey,
        }),
      );
    }

    beforeAll(async () => {
      await owner.execute(sql`
        insert into "user" (id, name, email, email_verified, created_at, updated_at)
        values (${userId}, 'Ada Lovelace', ${address}, true, now(), now())`);
      await owner.execute(sql`
        insert into bid_identity_directory (subject_id, email, name, email_verified, identity_created_at)
        values (${userId}, ${address}, 'Ada Lovelace', true, now())`);
    });

    afterAll(async () => {
      await owner.delete(emailOutbox).where(eq(emailOutbox.userId, userId));
      await owner.execute(sql`delete from bid_identity_directory where subject_id = ${userId}`);
      await owner.execute(sql`delete from "user" where id = ${userId}`);
    });

    it("queues one email for a decision however many times it is queued", async () => {
      const first = await queueDecisionEmail();
      const again = await queueDecisionEmail();

      expect(again.outboxId).toBe(first.outboxId);
      const rows = await owner.select().from(emailOutbox).where(eq(emailOutbox.userId, userId));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: "pending", attempts: 0, template: "kyc-declined" });
    });

    it("hands the pending email to the queue, and sends it again after a failed attempt", async () => {
      const queued = await row();
      // Old enough for the drain to take it, and first in line among any other waiting mail.
      await owner
        .update(emailOutbox)
        .set({ createdAt: new Date("2000-01-01T00:00:00Z") })
        .where(eq(emailOutbox.userId, userId));

      const jobs: Array<{ outboxId: string }> = [];
      const drained = await enqueueStaleEmailOutboxRows({
        outboxRepo,
        queue: {
          add: async (_name: string, data: { outboxId: string }) => jobs.push(data),
        } as never,
      });
      expect(drained).toBeGreaterThanOrEqual(1);
      expect(jobs).toContainEqual({ outboxId: queued?.id });

      const send = vi
        .fn()
        .mockRejectedValueOnce(new Error("provider unavailable"))
        .mockResolvedValue({ messageId: "message-1" });
      const deps = { outboxRepo, sender: { send }, log };

      await expect(sendEmailUseCase(deps, { outboxId: queued?.id as string })).rejects.toThrow(
        "provider unavailable",
      );
      expect(await row()).toMatchObject({
        status: "pending",
        attempts: 1,
        lastError: expect.stringContaining("provider unavailable"),
      });

      // The queue's retry runs the same job again.
      await sendEmailUseCase(deps, { outboxId: queued?.id as string });

      expect(await row()).toMatchObject({ status: "sent", attempts: 2, messageId: "message-1" });
      expect(send).toHaveBeenCalledTimes(2);
      // The address is read from the account when sent, and is the one the account has.
      expect(send.mock.calls[1]?.[0]).toMatchObject({ template: "kyc-declined", to: address });
    });
  },
);
