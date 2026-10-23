import type { IdentityDatabase } from "@auction/identity-db";
import { authSecurityEffectOutbox } from "@auction/identity-db/schema";
import { and, eq, inArray, lte } from "drizzle-orm";
import type {
  SecurityEffectJob,
  SecurityEffectOutboxRepository,
  StoredSecurityEffect,
} from "../services/durable-security-effects.js";

/** `last_error` is read by operators only; keep it short and never store request data in it. */
const MAX_ERROR_LENGTH = 500;

export class DrizzleSecurityEffectOutboxRepository implements SecurityEffectOutboxRepository {
  constructor(private readonly db: IdentityDatabase) {}

  async enqueue(input: {
    job: SecurityEffectJob;
    error: string;
    nextAttemptAt: Date;
  }): Promise<void> {
    await this.db.insert(authSecurityEffectOutbox).values({
      kind: input.job.kind,
      payload: input.job,
      userId: input.job.userId,
      lastError: input.error.slice(0, MAX_ERROR_LENGTH),
      nextAttemptAt: input.nextAttemptAt,
    });
  }

  async claimDue(input: {
    now: Date;
    staleBefore: Date;
    batchSize: number;
  }): Promise<StoredSecurityEffect[]> {
    await this.db
      .update(authSecurityEffectOutbox)
      .set({ status: "pending", claimedAt: null, updatedAt: input.now })
      .where(
        and(
          eq(authSecurityEffectOutbox.status, "running"),
          lte(authSecurityEffectOutbox.claimedAt, input.staleBefore),
        ),
      );
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: authSecurityEffectOutbox.id,
          payload: authSecurityEffectOutbox.payload,
          attemptCount: authSecurityEffectOutbox.attemptCount,
        })
        .from(authSecurityEffectOutbox)
        .where(
          and(
            eq(authSecurityEffectOutbox.status, "pending"),
            lte(authSecurityEffectOutbox.nextAttemptAt, input.now),
          ),
        )
        .orderBy(authSecurityEffectOutbox.nextAttemptAt)
        .limit(input.batchSize)
        .for("update", { skipLocked: true });
      if (rows.length > 0) {
        await tx
          .update(authSecurityEffectOutbox)
          .set({ status: "running", claimedAt: input.now, updatedAt: input.now })
          .where(
            inArray(
              authSecurityEffectOutbox.id,
              rows.map((row) => row.id),
            ),
          );
      }
      return rows.map((row) => ({
        id: row.id,
        job: row.payload as SecurityEffectJob,
        attemptCount: row.attemptCount,
      }));
    });
  }

  async complete(id: string): Promise<void> {
    await this.db.delete(authSecurityEffectOutbox).where(eq(authSecurityEffectOutbox.id, id));
  }

  async retryLater(input: {
    id: string;
    attemptCount: number;
    error: string;
    nextAttemptAt: Date;
    now: Date;
  }): Promise<void> {
    await this.db
      .update(authSecurityEffectOutbox)
      .set({
        status: "pending",
        claimedAt: null,
        attemptCount: input.attemptCount,
        lastError: input.error.slice(0, MAX_ERROR_LENGTH),
        nextAttemptAt: input.nextAttemptAt,
        updatedAt: input.now,
      })
      .where(eq(authSecurityEffectOutbox.id, input.id));
  }

  async abandon(input: {
    id: string;
    attemptCount: number;
    error: string;
    now: Date;
  }): Promise<void> {
    await this.db
      .update(authSecurityEffectOutbox)
      .set({
        status: "abandoned",
        claimedAt: null,
        attemptCount: input.attemptCount,
        lastError: input.error.slice(0, MAX_ERROR_LENGTH),
        updatedAt: input.now,
      })
      .where(eq(authSecurityEffectOutbox.id, input.id));
  }
}
