import type { IDomainEventDeliveryRepository } from "@auction/persistence/interfaces";
import {
  ARTWORK_WRITEBACK_SKIP,
  type DomainEventConsumer,
  ZOHO_MIRROR_CONSUMER,
  type ZohoMirrorMode,
  listDomainEventTypesForConsumer,
} from "@auction/types";
import { ZOHO_ARTWORK_LISTING_PROJECTOR } from "../../projectors/zoho-artwork-listing-projector.js";
import type { ZohoModes } from "./zoho-live-modes.js";

/**
 * The Zoho write-backs that can be caught up after going live, and the mode each runs in. Each
 * reads LAX (and Zoho) when it handles an event, never the event's own snapshot, and writes only
 * what differs, so handling an old event again sends the state that is true now, once.
 */
export const ZOHO_CATCH_UP_CONSUMERS = {
  [ZOHO_MIRROR_CONSUMER.artwork]: "ZOHO_ARTWORK_WRITEBACK_MODE",
  [ZOHO_ARTWORK_LISTING_PROJECTOR]: "ZOHO_ARTWORK_LISTING_MODE",
  [ZOHO_MIRROR_CONSUMER.order]: "ZOHO_FULFILMENT_MIRROR_MODE",
} as const satisfies Partial<Record<DomainEventConsumer, keyof ZohoModes>>;

export type ZohoCatchUpConsumer = keyof typeof ZOHO_CATCH_UP_CONSUMERS;

export function isZohoCatchUpConsumer(value: string): value is ZohoCatchUpConsumer {
  return Object.hasOwn(ZOHO_CATCH_UP_CONSUMERS, value);
}

/** The reason every Zoho write-back leaves on a delivery it skipped in a dry run. */
export const DRY_RUN_SKIP_REASON = ARTWORK_WRITEBACK_SKIP.dryRun;

/** Deliveries put back per statement, so one run never holds a long lock on the ledger. */
export const CATCH_UP_PAGE_SIZE = 500;

export type ZohoCatchUpSummary = {
  consumer: ZohoCatchUpConsumer;
  mode: ZohoMirrorMode;
  /** `false` is a preview: it counts and changes nothing. */
  apply: boolean;
  /** Deliveries this consumer skipped as `dry_run` when the run started. */
  dryRunSkipped: number;
  /** Deliveries put back to pending for the live worker to send (0 in a preview). */
  requeued: number;
  /** Deliveries still skipped as `dry_run` after a run with `limit`; run again for the rest. */
  remaining: number;
};

/**
 * Catches one Zoho write-back up after it is switched from `dry_run` to `live`. A dry run marks
 * each delivery skipped (`dry_run`), and skipped deliveries are never claimed again, so what
 * changed during the dry run would otherwise never reach Zoho. This puts exactly those deliveries
 * back to pending; the live worker then sends them through its usual drain (one at a time, through
 * the shared Zoho rate limit, circuit breaker, retries and dead-letter ledger).
 *
 * Refuses unless the consumer's mode is `live`: in `dry_run` the worker would skip them again, and
 * in `off` it would mark them `writeback_off`, losing the `dry_run` mark this run looks for. Safe
 * to run again: a delivery the live worker has handled is no longer skipped as `dry_run`.
 */
export async function catchUpAfterGoingLive(input: {
  consumer: ZohoCatchUpConsumer;
  mode: ZohoMirrorMode;
  apply: boolean;
  /** At most this many deliveries are put back in this run; the rest wait for the next run. */
  limit?: number;
  repo: Pick<
    IDomainEventDeliveryRepository,
    "countSkippedForEventTypes" | "replaySkippedForEventTypes"
  >;
  pageSize?: number;
}): Promise<ZohoCatchUpSummary> {
  const { consumer, mode, apply, repo } = input;
  if (apply && mode !== "live") {
    throw new Error(
      `${consumer} is ${mode}, not live: switch ${ZOHO_CATCH_UP_CONSUMERS[consumer]} to live and restart the worker first`,
    );
  }
  const filter = {
    consumer,
    eventTypes: listDomainEventTypesForConsumer(consumer),
    reason: DRY_RUN_SKIP_REASON,
  };
  const dryRunSkipped = await repo.countSkippedForEventTypes(filter);
  const target = Math.min(dryRunSkipped, input.limit ?? dryRunSkipped);
  const pageSize = input.pageSize ?? CATCH_UP_PAGE_SIZE;

  let requeued = 0;
  // Bounded by the count taken at the start, so deliveries skipped while it runs are left alone.
  while (apply && requeued < target) {
    const replayed = await repo.replaySkippedForEventTypes({
      ...filter,
      limit: Math.min(pageSize, target - requeued),
    });
    requeued += replayed;
    if (replayed === 0) break;
  }
  return { consumer, mode, apply, dryRunSkipped, requeued, remaining: dryRunSkipped - requeued };
}
