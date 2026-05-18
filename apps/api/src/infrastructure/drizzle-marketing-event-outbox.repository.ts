import type { Database } from "@auction/db";
import { marketingEventOutbox } from "@auction/db/schema";
import type { MarketingEvent } from "@auction/types";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type {
  IMarketingEventOutboxRepository,
  MarketingEventOutboxRow,
} from "../services/interfaces/marketing-event-outbox.js";

const STUCK_AFTER_MS = 60_000;
const CLAIMED_STALE_MS = 10 * 60_000;
export const MARKETING_OUTBOX_MAX_ATTEMPTS = 10;

type ClaimedRow = {
  id: string;
  event_id: string;
  name: string;
  payload: MarketingEvent;
  state: string;
  attempts: number;
  last_error: string | null;
  created_at: Date;
  sent_at: Date | null;
};

function mapClaimedRow(r: ClaimedRow): MarketingEventOutboxRow {
  return {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    payload: r.payload,
    state: r.state as MarketingEventOutboxRow["state"],
    attempts: r.attempts,
    lastError: r.last_error,
    createdAt: r.created_at,
    sentAt: r.sent_at,
  };
}

function rowsFromExecuteResult(result: unknown): ClaimedRow[] {
  if (Array.isArray(result)) return result as ClaimedRow[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows?: ClaimedRow[] }).rows ?? [];
  }
  return [];
}

export class DrizzleMarketingEventOutboxRepository implements IMarketingEventOutboxRepository {
  constructor(private readonly db: Database) {}

  async append(event: MarketingEvent, tx?: Database): Promise<boolean> {
    const conn = tx ?? this.db;
    const inserted = await conn
      .insert(marketingEventOutbox)
      .values({
        eventId: event.eventId,
        name: event.name,
        payload: event,
        state: "pending",
      })
      .onConflictDoNothing({ target: marketingEventOutbox.eventId })
      .returning({ id: marketingEventOutbox.id });
    return inserted.length > 0;
  }

  async releaseStaleClaims(): Promise<number> {
    const staleBefore = new Date(Date.now() - CLAIMED_STALE_MS);
    const updated = await this.db
      .update(marketingEventOutbox)
      .set({ state: "pending", claimedAt: null })
      .where(
        and(
          eq(marketingEventOutbox.state, "claimed"),
          lt(marketingEventOutbox.claimedAt, staleBefore),
        ),
      )
      .returning({ id: marketingEventOutbox.id });
    return updated.length;
  }

  async claim(batchSize: number): Promise<MarketingEventOutboxRow[]> {
    const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS);
    await this.releaseStaleClaims();

    return this.db.transaction(async (tx) => {
      const selected = await tx.execute(sql`
        SELECT id, event_id, name, payload, state, attempts, last_error, created_at, sent_at
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

      return rows.map((r) => mapClaimedRow({ ...r, state: "claimed" }));
    });
  }

  async ack(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(marketingEventOutbox)
      .set({ state: "sent", sentAt: new Date(), lastError: null, claimedAt: null })
      .where(inArray(marketingEventOutbox.id, ids));
  }

  async fail(id: string, error: string): Promise<void> {
    await this.db
      .update(marketingEventOutbox)
      .set({
        state: "failed",
        lastError: error.slice(0, 2000),
        claimedAt: null,
        attempts: sql`${marketingEventOutbox.attempts} + 1`,
      })
      .where(eq(marketingEventOutbox.id, id));
  }

  async markSkipped(event: MarketingEvent, reason: string, tx?: Database): Promise<void> {
    const conn = tx ?? this.db;
    await conn
      .insert(marketingEventOutbox)
      .values({
        eventId: event.eventId,
        name: event.name,
        payload: event,
        state: "skipped",
        lastError: reason.slice(0, 2000),
        sentAt: null,
      })
      .onConflictDoUpdate({
        target: marketingEventOutbox.eventId,
        set: {
          state: "skipped",
          lastError: reason.slice(0, 2000),
          sentAt: null,
          claimedAt: null,
        },
      });
  }
}
