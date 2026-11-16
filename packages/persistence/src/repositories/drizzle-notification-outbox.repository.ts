import type { Database } from "@auction/db";
import { notificationOutbox } from "@auction/db/schema";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type {
  INotificationOutboxRepository,
  NotificationOutboxRow,
  NotificationPayload,
  StageNotificationOutboxInput,
} from "../interfaces/notification-outbox.repository.js";
import {
  NOTIFICATION_OUTBOX_CLAIM_GUARD_MS,
  NOTIFICATION_OUTBOX_MAX_ATTEMPTS,
  NOTIFICATION_OUTBOX_RETRY_BASE_MS,
  NOTIFICATION_OUTBOX_RETRY_MAX_MS,
} from "../lib/notification-outbox-claim.js";
import {
  NOTIFICATION_OUTBOX_WAKE_CHANNEL,
  isCriticalNotificationType,
} from "../lib/notification-outbox-wake.js";

/** A claim not acked or failed within this long (a drain that died) goes back to pending. */
const CLAIMED_STALE_MS = 10 * 60_000;
export { NOTIFICATION_OUTBOX_MAX_ATTEMPTS };

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
    if (inserted.length > 0 && isCriticalNotificationType(input.payload.type)) {
      // Delivered by Postgres on commit only (and once per channel/payload per transaction), so
      // the worker drains the row as soon as it is visible and never for a rolled-back stage.
      await conn.execute(sql`SELECT pg_notify(${NOTIFICATION_OUTBOX_WAKE_CHANNEL}, '')`);
    }
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
    const now = Date.now();
    // Debounce: only claim rows at least this old so in-flight transactions have committed.
    const stuckBefore = new Date(now - NOTIFICATION_OUTBOX_CLAIM_GUARD_MS);
    await this.releaseStaleClaims();

    return this.db.transaction(async (tx) => {
      const selected = await tx.execute(sql`
        SELECT id, idempotency_key, user_id, payload, state, attempts, last_error, created_at, processed_at, claimed_at
        FROM notification_outbox
        WHERE state = 'pending'
          AND created_at < ${stuckBefore}
          AND attempts < ${NOTIFICATION_OUTBOX_MAX_ATTEMPTS}
          -- Retry backoff (notificationOutboxRetryDelayMs): a row that failed waits before it is
          -- tried again, however often drains run, so a short outage cannot use up its attempts.
          AND (
            last_attempt_at IS NULL
            OR last_attempt_at < ${new Date(now)}::timestamptz - make_interval(
              secs => LEAST(
                ${NOTIFICATION_OUTBOX_RETRY_MAX_MS}::double precision,
                ${NOTIFICATION_OUTBOX_RETRY_BASE_MS}::double precision * power(2, GREATEST(attempts - 1, 0))
              ) / 1000
            )
          )
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
        lastAttemptAt: new Date(),
      })
      .where(eq(notificationOutbox.id, id));
  }
}
