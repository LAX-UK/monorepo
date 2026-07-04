import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const LOT_INVOICE_INITIATION_PROJECTOR = "lot_invoice_initiation";

type LotEndedPayload = {
  outcome?: string;
  winnerId?: string | null;
};

export async function processLotInvoiceInitiation(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
  ensureLotInvoice: (lotId: string) => Promise<void>;
}): Promise<void> {
  const { ctx, log, ensureLotInvoice } = options;
  const { projectorStateRepo, domainEventReader, projectorFailureRecorder } = ctx;

  const cursor = await projectorStateRepo.getCursor(LOT_INVOICE_INITIATION_PROJECTOR);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["lot.ended"],
    limit: 50,
  });

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
      const outcome = await projectorFailureRecorder.record({
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
    await projectorStateRepo.advanceCursor(LOT_INVOICE_INITIATION_PROJECTOR, maxId);
  }
}
