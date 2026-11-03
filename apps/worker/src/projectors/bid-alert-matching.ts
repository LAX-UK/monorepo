import type pino from "pino";
import type { BidAlertMatching, SalePublishedEvent } from "./lib/bid-alert-matching.types.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const BID_ALERT_MATCHING_PROJECTOR = "bid_alert_matching";

type SalePublishedPayload = { announce?: unknown; lotCount?: unknown } | null;

export function salePublishedEvent(row: {
  aggregateId: string;
  payload: unknown;
}): SalePublishedEvent {
  const payload = row.payload as SalePublishedPayload;
  return {
    saleId: row.aggregateId,
    announce: payload?.announce !== false,
    lotCount: typeof payload?.lotCount === "number" ? payload.lotCount : null,
  };
}

let warnedUnseeded = false;

/**
 * Reads `sale.published` and records who should hear about the sale. The lifecycle code that
 * publishes sales is unchanged, and a replayed event changes nothing: an item is announced once.
 */
export async function processBidAlertMatching(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
  matching: BidAlertMatching;
}): Promise<void> {
  const { ctx, log, matching } = options;
  const { projectorStateRepo, domainEventReader, projectorFailureRecorder } = ctx;
  if (!(await matching.isSeeded())) {
    if (!warnedUnseeded) {
      warnedUnseeded = true;
      log.warn(
        { projector: BID_ALERT_MATCHING_PROJECTOR },
        "alerts are on but the first-run seed has not run: nothing is announced until it does",
      );
    }
    return;
  }
  const cursor = await projectorStateRepo.getCursor(BID_ALERT_MATCHING_PROJECTOR);
  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["sale.published"],
    limit: 50,
  });
  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      await matching.handle(salePublishedEvent(row));
      maxId = row.id;
    } catch (err) {
      const outcome = await projectorFailureRecorder.record({
        log,
        projectorName: BID_ALERT_MATCHING_PROJECTOR,
        eventId: row.id,
        err,
      });
      if (outcome.action === "skip") {
        maxId = row.id;
        continue;
      }
      break;
    }
  }
  if (maxId > cursor) await projectorStateRepo.advanceCursor(BID_ALERT_MATCHING_PROJECTOR, maxId);
}
