import type { Database } from "@auction/db";
import { marketingEventOutbox } from "@auction/db/schema";
import type { MarketingEvent } from "@auction/types";
import { and, eq, inArray, lt, sql } from "drizzle-orm";

const STUCK_AFTER_MS = 60_000;
const CLAIMED_STALE_MS = 10 * 60_000;
export const MARKETING_OUTBOX_MAX_ATTEMPTS = 10;

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

/**
 * Atomically transition a single outbox row from `pending` → `claimed` for the
 * BullMQ processor path. Returns true when the claim succeeded; false when the
 * row is absent, already claimed by the poller, or in a terminal state — in
 * which case the caller should skip processing to avoid duplicate delivery.
 */
export async function claimSingleOutboxRow(db: Database, eventId: string): Promise<boolean> {
  const result = await db
    .update(marketingEventOutbox)
    .set({ state: "claimed", claimedAt: new Date() })
    .where(
      and(eq(marketingEventOutbox.eventId, eventId), eq(marketingEventOutbox.state, "pending")),
    )
    .returning({ id: marketingEventOutbox.id });
  return result.length > 0;
}

export async function claimMarketingEventOutbox(
  db: Database,
  batchSize: number,
): Promise<MarketingEvent[]> {
  const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS);
  const staleBefore = new Date(Date.now() - CLAIMED_STALE_MS);

  await db
    .update(marketingEventOutbox)
    .set({ state: "pending", claimedAt: null })
    .where(
      and(
        eq(marketingEventOutbox.state, "claimed"),
        lt(marketingEventOutbox.claimedAt, staleBefore),
      ),
    );

  return db.transaction(async (tx) => {
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
