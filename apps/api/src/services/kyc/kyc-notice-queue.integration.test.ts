import { createDb } from "@auction/db";
import { emailOutbox, notification } from "@auction/db/schema";
import { PostmarkEmailService } from "@auction/email";
import {
  DrizzleNotificationWriteRepository,
  DrizzleUserRepository,
} from "@auction/persistence/repositories";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NotificationFactory } from "../notification.factory.js";
import { KycNoticeQueue } from "./kyc-notice-queue.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)(
  "identity check notices are stored with the decision (integration)",
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const suffix = Math.random().toString(36).slice(2, 10);
    const userId = `kyc-notice-${suffix}`;
    const address = `${userId}@integration.test`;
    const queueAdd = vi.fn(async () => undefined);
    const email = new PostmarkEmailService(db, { add: queueAdd });
    const notices = new KycNoticeQueue({
      usersFor: (tx) => new DrizzleUserRepository(tx ?? db),
      notificationsFor: (tx) => new DrizzleNotificationWriteRepository(tx ?? db),
      email,
      factory: new NotificationFactory(),
      webOrigin: "https://lax.bid",
    });
    const approved = {
      userId,
      outcome: "approved" as const,
      providerSessionId: `session-${suffix}`,
      providerAttemptId: "attempt-1",
    };
    const key = `kyc-approved:${userId}:session-${suffix}:attempt-1`;

    const outboxRows = () => db.select().from(emailOutbox).where(eq(emailOutbox.userId, userId));
    const notificationRows = () =>
      db.select().from(notification).where(eq(notification.userId, userId));

    beforeAll(async () => {
      await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'Ada Lovelace', ${address}, true, now(), now())`);
      await db.execute(sql`
      insert into bid_identity_directory (subject_id, email, name, email_verified, identity_created_at)
      values (${userId}, ${address}, 'Ada Lovelace', true, now())`);
    });

    afterAll(async () => {
      await db.delete(notification).where(eq(notification.userId, userId));
      await db.delete(emailOutbox).where(eq(emailOutbox.userId, userId));
      await db.execute(sql`delete from bid_identity_directory where subject_id = ${userId}`);
      await db.execute(sql`delete from "user" where id = ${userId}`);
    });

    it("stores nothing when the decision's transaction rolls back", async () => {
      await expect(
        db.transaction(async (tx) => {
          await notices.queueOutcome(tx, approved);
          throw new Error("decision could not be applied");
        }),
      ).rejects.toThrow("decision could not be applied");

      expect(await outboxRows()).toHaveLength(0);
      expect(await notificationRows()).toHaveLength(0);
    });

    it("stores the email and the in-app notice together with the committed decision", async () => {
      await db.transaction((tx) => notices.queueOutcome(tx, approved));

      const rows = await outboxRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        idempotencyKey: key,
        template: "kyc-approved",
        status: "pending",
        userId,
      });
      // Neither the key nor the row carries the address: it is read from the account when sent.
      expect(rows[0]?.idempotencyKey).not.toContain("@");
      expect(rows[0]?.toSnapshot).toBeNull();
      expect(await notificationRows()).toHaveLength(1);
      // The send is the outbox's job: nothing was put on the queue inside the transaction.
      expect(queueAdd).not.toHaveBeenCalled();
    });

    it("makes one email when the same decision is queued twice", async () => {
      const before = (await outboxRows())[0];

      await db.transaction((tx) => notices.queueOutcome(tx, approved));

      const rows = await outboxRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(before?.id);
      // The in-app notice has no key, so only the decision's claim keeps a repeat delivery from
      // queueing it again (see the duplicate-delivery tests); queued directly, it is written again.
      expect(await notificationRows()).toHaveLength(2);
    });
  },
);
