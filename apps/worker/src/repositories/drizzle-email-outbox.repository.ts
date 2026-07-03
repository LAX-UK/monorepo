import type { Database } from "@auction/db";
import type { EmailSuppressionReason } from "@auction/db/schema";
import { emailOutbox, emailSuppression, user } from "@auction/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import type {
  EmailOutboxRow,
  IEmailOutboxRepository,
} from "./interfaces/email-outbox.repository.js";

function mapRow(row: typeof emailOutbox.$inferSelect): EmailOutboxRow {
  return {
    id: row.id,
    status: row.status,
    attempts: row.attempts,
    toEmailHash: row.toEmailHash,
    toSnapshot: row.toSnapshot,
    userId: row.userId,
    template: row.template,
    vars: row.vars,
    stream: row.stream,
    flaggedAddress: row.flaggedAddress,
    category: row.category,
  };
}

export class DrizzleEmailOutboxRepository implements IEmailOutboxRepository {
  constructor(private readonly db: Database) {}

  async claimForSend(outboxId: string): Promise<EmailOutboxRow | null> {
    const row = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(emailOutbox)
        .set({
          status: "sending",
          attempts: sql`${emailOutbox.attempts} + 1`,
          lastError: null,
        })
        .where(and(eq(emailOutbox.id, outboxId), eq(emailOutbox.status, "pending")))
        .returning();
      if (updated) return updated;

      const [existing] = await tx
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.id, outboxId))
        .limit(1);
      return existing ?? null;
    });
    return row ? mapRow(row) : null;
  }

  async findSuppression(emailHash: string): Promise<boolean> {
    const [supNow] = await this.db
      .select({ emailHash: emailSuppression.emailHash })
      .from(emailSuppression)
      .where(eq(emailSuppression.emailHash, emailHash))
      .limit(1);
    return supNow != null;
  }

  async markSuppressed(outboxId: string, reason: string): Promise<void> {
    await this.db
      .update(emailOutbox)
      .set({ status: "suppressed", lastError: reason })
      .where(eq(emailOutbox.id, outboxId));
  }

  async markSent(outboxId: string, messageId: string): Promise<void> {
    await this.db
      .update(emailOutbox)
      .set({ status: "sent", messageId, sentAt: new Date(), lastError: null })
      .where(eq(emailOutbox.id, outboxId));
  }

  async markFailedOrPending(outboxId: string, message: string, terminal: boolean): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(emailOutbox)
        .set({
          status: terminal ? "failed" : "pending",
          lastError: message,
        })
        .where(eq(emailOutbox.id, outboxId));
    });
  }

  async resolveUserEmail(userId: string): Promise<string | null> {
    const [recipient] = await this.db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return recipient?.email ?? null;
  }

  async insertSuppression(emailHash: string, reason: EmailSuppressionReason): Promise<void> {
    await this.db.insert(emailSuppression).values({ emailHash, reason }).onConflictDoNothing();
  }

  async findStalePendingIds(): Promise<Array<{ id: string }>> {
    return this.db
      .select({ id: emailOutbox.id })
      .from(emailOutbox)
      .where(
        and(
          eq(emailOutbox.status, "pending"),
          lt(emailOutbox.createdAt, sql`now() - interval '5 minutes'`),
          lt(emailOutbox.attempts, 5),
        ),
      )
      .limit(100)
      .for("update", { skipLocked: true });
  }
}
