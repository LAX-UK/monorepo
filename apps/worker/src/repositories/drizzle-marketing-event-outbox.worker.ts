import type { Database } from "@auction/db";
import { marketingEventOutbox } from "@auction/db/schema";
import type { MarketingEvent, PublishOutcome } from "@auction/types";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import {
  type IMarketingEventOutboxWorker,
  MARKETING_OUTBOX_MAX_ATTEMPTS,
  type MarketingFailureOutcome,
} from "../interfaces/marketing-event-outbox.worker.js";

const STUCK_AFTER_MS = 60_000;
const CLAIMED_STALE_MS = 10 * 60_000;

type ClaimedRow = {
  id: string;
  event_id: string;
  name: string;
  payload: MarketingEvent;
  attempts: number;
};

function rowsFromExecuteResult(result: unknown): ClaimedRow[] {
  if (Array.isArray(result)) return result as ClaimedRow[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows?: ClaimedRow[] }).rows ?? [];
  }
  return [];
}

export class DrizzleMarketingEventOutboxWorker implements IMarketingEventOutboxWorker {
  constructor(private readonly db: Database) {}

  async claimSingle(eventId: string): Promise<boolean> {
    const result = await this.db
      .update(marketingEventOutbox)
      .set({ state: "claimed", claimedAt: new Date() })
      .where(
        and(eq(marketingEventOutbox.eventId, eventId), eq(marketingEventOutbox.state, "pending")),
      )
      .returning({ id: marketingEventOutbox.id });
    return result.length > 0;
  }

  async claimStuckBatch(batchSize: number): Promise<MarketingEvent[]> {
    const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS);
    const staleBefore = new Date(Date.now() - CLAIMED_STALE_MS);

    await this.db
      .update(marketingEventOutbox)
      .set({ state: "pending", claimedAt: null })
      .where(
        and(
          eq(marketingEventOutbox.state, "claimed"),
          lt(marketingEventOutbox.claimedAt, staleBefore),
        ),
      );

    return this.db.transaction(async (tx) => {
      const selected = await tx.execute(sql`
        SELECT id, event_id, name, payload, attempts
        FROM marketing_event_outbox
        WHERE state = 'pending'
          AND created_at < ${stuckBefore}
          AND attempts < ${MARKETING_OUTBOX_MAX_ATTEMPTS}
        ORDER BY created_at
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `);

      const rows = rowsFromExecuteResult(selected);
      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);
      await tx
        .update(marketingEventOutbox)
        .set({ state: "claimed", claimedAt: new Date() })
        .where(inArray(marketingEventOutbox.id, ids));

      return rows.map((r) => r.payload as MarketingEvent);
    });
  }

  async applyPublishOutcome(
    event: MarketingEvent,
    outcome: PublishOutcome,
  ): Promise<MarketingFailureOutcome | null> {
    if (outcome.status === "sent") {
      await this.db
        .update(marketingEventOutbox)
        .set({ state: "sent", sentAt: new Date(), lastError: null })
        .where(eq(marketingEventOutbox.eventId, event.eventId));
      return null;
    }

    if (outcome.status === "skipped") {
      await this.db
        .update(marketingEventOutbox)
        .set({ state: "skipped", lastError: outcome.reason, sentAt: null, claimedAt: null })
        .where(eq(marketingEventOutbox.eventId, event.eventId));
      return null;
    }

    const [row] = await this.db
      .select()
      .from(marketingEventOutbox)
      .where(eq(marketingEventOutbox.eventId, event.eventId))
      .limit(1);

    const nextAttempts = (row?.attempts ?? 0) + 1;
    const attemptsExceeded = nextAttempts >= MARKETING_OUTBOX_MAX_ATTEMPTS;
    const retryable = outcome.retryable && !attemptsExceeded;

    if (row) {
      await this.db
        .update(marketingEventOutbox)
        .set({
          state: retryable ? "pending" : "failed",
          lastError: outcome.error.slice(0, 2000),
          attempts: nextAttempts,
          claimedAt: null,
        })
        .where(eq(marketingEventOutbox.id, row.id));
    }

    return { nextAttempts, attemptsExceeded, shouldRetry: retryable };
  }

  async purgeStaleTerminal(staleBefore: Date): Promise<number> {
    const deleted = await this.db
      .delete(marketingEventOutbox)
      .where(
        and(
          inArray(marketingEventOutbox.state, ["sent", "skipped", "failed"]),
          lt(marketingEventOutbox.createdAt, staleBefore),
        ),
      )
      .returning({ id: marketingEventOutbox.id });
    return deleted.length;
  }
}
