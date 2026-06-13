import type { Database } from "@auction/db";
import { notificationOutbox } from "@auction/db/schema";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { NotificationPayload } from "../services/interfaces/notification-channel.js";
import type {
  INotificationOutboxRepository,
  NotificationOutboxRow,
  StageNotificationOutboxInput,
} from "../services/interfaces/notification-outbox.js";

const STUCK_AFTER_MS = 1_000;
/** Debounce: only claim rows at least this old so in-flight transactions have committed. */
const CLAIMED_STALE_MS = 10 * 60_000;
export const NOTIFICATION_OUTBOX_MAX_ATTEMPTS = 10;

type ClaimedRow = {
  id: string;
  idempotency_key: string;
  user_id: string;
  payload: NotificationPayload;
  state: string;
  attempts: number;
  last_error: string | null;
  created_at: Date;
  processed_at: Date | null;
  claimed_at: Date | null;
};

function mapClaimedRow(r: ClaimedRow): NotificationOutboxRow {
  return {
    id: r.id,
    idempotencyKey: r.idempotency_key,
    userId: r.user_id,
    payload: r.payload,
    state: r.state as NotificationOutboxRow["state"],
    attempts: r.attempts,
    lastError: r.last_error,
    createdAt: r.created_at,
    processedAt: r.processed_at,
    claimedAt: r.claimed_at,
  };
}

function rowsFromExecuteResult(result: unknown): ClaimedRow[] {
  if (Array.isArray(result)) return result as ClaimedRow[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows?: ClaimedRow[] }).rows ?? [];
  }
  return [];
}

export class DrizzleNotificationOutboxRepository implements INotificationOutboxRepository {
  constructor(private readonly db: Database) {}

  async stage(input: StageNotificationOutboxInput, tx?: Database): Promise<boolean> {
    const conn = tx ?? this.db;
    const inserted = await conn
      .insert(notificationOutbox)
      .values({
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
        payload: input.payload,
        state: "pending",
      })
      .onConflictDoNothing({ target: notificationOutbox.idempotencyKey })
      .returning({ id: notificationOutbox.id });
    return inserted.length > 0;
  }

  async countPending(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.state, "pending"));
    return row?.count ?? 0;
  }

  async releaseStaleClaims(): Promise<number> {
    const staleBefore = new Date(Date.now() - CLAIMED_STALE_MS);
    const updated = await this.db
      .update(notificationOutbox)
      .set({ state: "pending", claimedAt: null })
      .where(
        and(eq(notificationOutbox.state, "claimed"), lt(notificationOutbox.claimedAt, staleBefore)),
      )
      .returning({ id: notificationOutbox.id });
    return updated.length;
  }

  async claim(batchSize: number): Promise<NotificationOutboxRow[]> {
    const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS);
    await this.releaseStaleClaims();

    return this.db.transaction(async (tx) => {
      const selected = await tx.execute(sql`
        SELECT id, idempotency_key, user_id, payload, state, attempts, last_error, created_at, processed_at, claimed_at
        FROM notification_outbox
        WHERE state = 'pending'
          AND created_at < ${stuckBefore}
          AND attempts < ${NOTIFICATION_OUTBOX_MAX_ATTEMPTS}
        ORDER BY created_at
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `);

      const rows = rowsFromExecuteResult(selected);
      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);
      await tx
        .update(notificationOutbox)
        .set({ state: "claimed", claimedAt: new Date() })
        .where(inArray(notificationOutbox.id, ids));

      return rows.map((r) => mapClaimedRow({ ...r, state: "claimed" }));
    });
  }

  async ack(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(notificationOutbox)
      .set({
        state: "sent",
        processedAt: new Date(),
        lastError: null,
        claimedAt: null,
      })
      .where(inArray(notificationOutbox.id, ids));
  }

  async fail(id: string, error: string): Promise<void> {
    const [row] = await this.db
      .select({ attempts: notificationOutbox.attempts })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.id, id))
      .limit(1);
    const nextAttempts = (row?.attempts ?? 0) + 1;
    const terminal = nextAttempts >= NOTIFICATION_OUTBOX_MAX_ATTEMPTS;
    await this.db
      .update(notificationOutbox)
      .set({
        state: terminal ? "failed" : "pending",
        lastError: error.slice(0, 2000),
        claimedAt: null,
        attempts: nextAttempts,
      })
      .where(eq(notificationOutbox.id, id));
  }
}
