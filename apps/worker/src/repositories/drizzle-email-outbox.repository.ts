import type { Database } from "@auction/db";
import type { EmailSuppressionReason } from "@auction/db/schema";
import { bidIdentityDirectory, emailOutbox, emailSuppression } from "@auction/db/schema";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import type {
  EmailOutboxClaimResult,
  EmailOutboxRecoveryRow,
  EmailOutboxRow,
  IEmailOutboxRepository,
} from "../interfaces/email-outbox.repository.js";

const STALE_SENDING_AFTER = sql`now() - interval '10 minutes'`;
const STALE_PENDING_ENQUEUE_AFTER = sql`now() - interval '30 seconds'`;
const MAX_SEND_ATTEMPTS = 5;

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

  async claimForSend(outboxId: string): Promise<EmailOutboxClaimResult | null> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(emailOutbox)
        .set({
          status: "sending",
          attempts: sql`${emailOutbox.attempts} + 1`,
          lastError: null,
          nextAttemptAt: new Date(),
        })
        .where(and(eq(emailOutbox.id, outboxId), eq(emailOutbox.status, "pending")))
        .returning();
      if (updated) {
        return { row: mapRow(updated), claimed: true };
      }

      const [existing] = await tx
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.id, outboxId))
        .limit(1);
      if (!existing) return null;
      return { row: mapRow(existing), claimed: false };
    });
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

  async markSentPersistenceFailed(
    outboxId: string,
    messageId: string,
    message: string,
  ): Promise<void> {
    await this.db
      .update(emailOutbox)
      .set({
        status: "sending",
        messageId,
        lastError: `sent_unconfirmed:${messageId}:${message}`,
      })
      .where(eq(emailOutbox.id, outboxId));
  }

  async resolveUserEmail(userId: string): Promise<string | null> {
    const [recipient] = await this.db
      .select({ email: bidIdentityDirectory.email })
      .from(bidIdentityDirectory)
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    return recipient?.email ?? null;
  }

  async insertSuppression(emailHash: string, reason: EmailSuppressionReason): Promise<void> {
    await this.db.insert(emailSuppression).values({ emailHash, reason }).onConflictDoNothing();
  }

  async recoverStaleForDispatch(): Promise<EmailOutboxRecoveryRow[]> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(emailOutbox)
        .set({
          status: "failed",
          lastError: "Stale sending lease exceeded max attempts",
        })
        .where(
          and(
            eq(emailOutbox.status, "sending"),
            lt(
              sql`coalesce(${emailOutbox.nextAttemptAt}, ${emailOutbox.createdAt})`,
              STALE_SENDING_AFTER,
            ),
            gte(emailOutbox.attempts, MAX_SEND_ATTEMPTS),
          ),
        );

      const recovered = await tx
        .update(emailOutbox)
        .set({ status: "pending", nextAttemptAt: null })
        .where(
          and(
            eq(emailOutbox.status, "sending"),
            lt(
              sql`coalesce(${emailOutbox.nextAttemptAt}, ${emailOutbox.createdAt})`,
              STALE_SENDING_AFTER,
            ),
            lt(emailOutbox.attempts, MAX_SEND_ATTEMPTS),
          ),
        )
        .returning({ id: emailOutbox.id, attempts: emailOutbox.attempts });

      const pending = await tx
        .select({ id: emailOutbox.id, attempts: emailOutbox.attempts })
        .from(emailOutbox)
        .where(
          and(
            eq(emailOutbox.status, "pending"),
            lt(emailOutbox.createdAt, STALE_PENDING_ENQUEUE_AFTER),
            lt(emailOutbox.attempts, MAX_SEND_ATTEMPTS),
          ),
        )
        .orderBy(asc(emailOutbox.createdAt))
        .limit(100)
        .for("update", { skipLocked: true });

      const byId = new Map<string, EmailOutboxRecoveryRow>();
      for (const row of recovered) {
        byId.set(row.id, { id: row.id, dispatchGeneration: row.attempts });
      }
      for (const row of pending) {
        if (!byId.has(row.id)) {
          byId.set(row.id, { id: row.id, dispatchGeneration: row.attempts });
        }
      }
      return [...byId.values()];
    });
  }
}
