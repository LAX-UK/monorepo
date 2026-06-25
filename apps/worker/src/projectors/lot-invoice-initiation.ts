import { domainEvent, projectorState } from "@auction/db";
import { and, eq, gt } from "drizzle-orm";
import type pino from "pino";
import { recordProjectorEventFailure } from "./lib/projector-failure-guard.js";

export const LOT_INVOICE_INITIATION_PROJECTOR = "lot_invoice_initiation";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type LotEndedPayload = {
  outcome?: string;
  winnerId?: string | null;
};

/**
 * Consumes `lot.ended` (sold + winner) and triggers idempotent invoice creation
 * via `POST /internal/jobs/ensure-lot-invoice`.
 */
export async function processLotInvoiceInitiation(options: {
  db: Db;
  log: pino.Logger;
  ensureLotInvoice: (lotId: string) => Promise<void>;
}): Promise<void> {
  const { db, log, ensureLotInvoice } = options;

  await db
    .insert(projectorState)
    .values({ projectorName: LOT_INVOICE_INITIATION_PROJECTOR, lastProcessedEventId: 0 })
    .onConflictDoNothing();

  const [cursorRow] = await db
    .select({ last: projectorState.lastProcessedEventId })
    .from(projectorState)
    .where(eq(projectorState.projectorName, LOT_INVOICE_INITIATION_PROJECTOR))
    .limit(1);
  const cursor = cursorRow?.last ?? 0;

  const rows = await db
    .select({
      id: domainEvent.id,
      aggregateId: domainEvent.aggregateId,
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(and(gt(domainEvent.id, cursor), eq(domainEvent.eventType, "lot.ended")))
    .orderBy(domainEvent.id)
    .limit(50);

  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      const payload = (row.payload ?? {}) as LotEndedPayload;
      if (payload.outcome !== "sold" || !payload.winnerId) {
        maxId = row.id;
        continue;
      }

      await ensureLotInvoice(row.aggregateId);
      maxId = row.id;
    } catch (err) {
      const outcome = await recordProjectorEventFailure({
        db,
        log,
        projectorName: LOT_INVOICE_INITIATION_PROJECTOR,
        eventId: row.id,
        err,
      });
      if (outcome.action === "skip") {
        maxId = row.id;
        continue;
      }
      return;
    }
  }

  if (maxId > cursor) {
    await db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, LOT_INVOICE_INITIATION_PROJECTOR));
  }
}
