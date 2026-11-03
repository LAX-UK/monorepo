import type pino from "pino";
import type {
  BidAlertMatching,
  LotPublishedEvent,
  SalePublishedEvent,
} from "./lib/bid-alert-matching.types.js";
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

export function lotPublishedEvent(row: { aggregateId: string }): LotPublishedEvent {
  return { lotId: row.aggregateId };
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
    eventTypes: ["sale.published", "lot.published"],
    limit: 50,
  });
  if (rows.length === 0) return;

  const attempt = async (row: { id: number }, work: () => Promise<unknown>) => {
    try {
      await work();
      return "done" as const;
    } catch (err) {
      const outcome = await projectorFailureRecorder.record({
        log,
        projectorName: BID_ALERT_MATCHING_PROJECTOR,
        eventId: row.id,
        err,
      });
      return outcome.action === "skip" ? ("skipped" as const) : ("halt" as const);
    }
  };

  // Lots published before matching was switched on are not news; every one after it is.
  const lotStart = rows.some((row) => row.eventType === "lot.published")
    ? await matching.lotStart()
    : 0;

  let maxId = cursor;
  // Lots published together are matched together, so a large sale costs one query per search.
  let lotRun: { id: number; event: LotPublishedEvent; fresh: boolean }[] = [];
  const flushLots = async (): Promise<boolean> => {
    const run = lotRun;
    lotRun = [];
    const last = run[run.length - 1];
    if (!last) return true;
    const fresh = run.filter((item) => item.fresh);
    const first = fresh[0];
    if (!first) {
      maxId = last.id;
      return true;
    }
    const batch = await attempt(first, () => matching.handleLots(fresh.map((item) => item.event)));
    if (batch === "done") {
      maxId = last.id;
      return true;
    }
    // One bad lot must not hold the others: matching is idempotent, so go one by one.
    for (const item of run) {
      if (!item.fresh) {
        maxId = item.id;
        continue;
      }
      const single = await attempt(item, () => matching.handleLots([item.event]));
      if (single === "halt") return false;
      maxId = item.id;
    }
    return true;
  };

  for (const row of rows) {
    if (row.eventType === "lot.published") {
      lotRun.push({ id: row.id, event: lotPublishedEvent(row), fresh: row.id > lotStart });
      continue;
    }
    if (!(await flushLots())) break;
    const result = await attempt(row, () => matching.handle(salePublishedEvent(row)));
    if (result === "halt") {
      lotRun = [];
      break;
    }
    maxId = row.id;
  }
  if (lotRun.length > 0) await flushLots();
  if (maxId > cursor) await projectorStateRepo.advanceCursor(BID_ALERT_MATCHING_PROJECTOR, maxId);
}
