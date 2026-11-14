import { isPermanentRevalidateFailure } from "@auction/background-runtime";
import {
  PUBLIC_PAGE_EVENT_TYPES,
  isPurgeablePublicCacheTag,
  publicPageLotEventNeedsSaleLookup,
  publicPageTagsForDomainEvent,
} from "@auction/domain";
import { captureBackgroundError } from "@auction/observability";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import type { WebPublicCacheDeps } from "./web-public-cache.types.js";

export const WEB_PUBLIC_CACHE_PROJECTOR = "web_public_cache";

const BATCH_SIZE = 200;

/** A batch still failing once its oldest event is this old is reported, not only logged. */
export const WEB_PUBLIC_CACHE_LAG_ALERT_MS = 15 * 60_000;

export type { WebPublicCacheDeps } from "./web-public-cache.types.js";

/**
 * After a committed change to a lot or a sale, asks the web app to drop the cached public reads
 * that show it (`POST /api/revalidate`), so the public sale and lot pages are never stale on a
 * status, a close time, a withdrawal or a publication. A batch is sent as one request.
 *
 * - A tag the web route would refuse (an id outside its allowlist) is dropped and logged before
 *   sending, so one odd payload cannot get the whole batch refused.
 * - When the web app cannot be reached, or answers 5xx, 408 or 429, the cursor stays and the batch
 *   is sent again on the next tick; once the batch's oldest event is 15 minutes old the failure is
 *   reported as well as logged.
 * - An answer that cannot change on a retry (another 4xx: a refused tag, a wrong secret, the route
 *   not configured) is logged at error level, reported, recorded on the projector's state, and
 *   the cursor moves past the batch, so it never blocks the purges after it. The cached reads it
 *   would have dropped expire on their own window.
 */
export async function processWebPublicCache(
  ctx: Pick<ProjectorRunContext, "projectorStateRepo" | "domainEventReader" | "log">,
  deps: WebPublicCacheDeps,
): Promise<void> {
  const { projectorStateRepo, domainEventReader, log } = ctx;
  await projectorStateRepo.ensureCursor(WEB_PUBLIC_CACHE_PROJECTOR);
  let cursor = await projectorStateRepo.getCursor(WEB_PUBLIC_CACHE_PROJECTOR);
  if (cursor === 0) {
    // Purging what changed before this projector existed would only re-read every page once.
    const latest = await deps.latestEventId();
    if (latest > 0) await projectorStateRepo.advanceCursor(WEB_PUBLIC_CACHE_PROJECTOR, latest);
    return;
  }

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: [...PUBLIC_PAGE_EVENT_TYPES],
    limit: BATCH_SIZE,
  });
  if (rows.length === 0) return;

  const tags = new Set<string>();
  const refused = new Set<string>();
  for (const row of rows) {
    const event = { eventType: row.eventType, aggregateId: row.aggregateId, payload: row.payload };
    const lotSaleId = publicPageLotEventNeedsSaleLookup(event)
      ? await deps.lotSaleId(row.aggregateId).catch(() => null)
      : null;
    for (const tag of publicPageTagsForDomainEvent(event, { lotSaleId })) {
      (isPurgeablePublicCacheTag(tag) ? tags : refused).add(tag);
    }
    cursor = Math.max(cursor, row.id);
  }
  if (refused.size > 0) {
    log.error(
      { tags: [...refused].slice(0, 10), count: refused.size, toEventId: cursor },
      "web_public_cache_tags_dropped",
    );
  }

  if (tags.size > 0) {
    try {
      await deps.invalidator.invalidate([...tags]);
    } catch (err) {
      const fromEventId = rows[0]?.id ?? cursor;
      if (!isPermanentRevalidateFailure(err)) {
        log.warn({ err, events: rows.length, fromEventId }, "web_public_cache_invalidate_failed");
        if (isLagging(rows, deps.now?.() ?? Date.now())) {
          captureBackgroundError("projector", err, {
            tags: { projector: WEB_PUBLIC_CACHE_PROJECTOR, outcome: "cursor_lagging" },
            extra: { fromEventId, toEventId: cursor },
          });
        }
        return;
      }
      const message = `Skipped events ${fromEventId}..${cursor}: ${
        err instanceof Error ? err.message : String(err)
      }`;
      log.error(
        { err, events: rows.length, fromEventId, toEventId: cursor },
        "web_public_cache_batch_rejected",
      );
      captureBackgroundError("projector", err, {
        tags: { projector: WEB_PUBLIC_CACHE_PROJECTOR, outcome: "batch_rejected" },
        extra: { fromEventId, toEventId: cursor },
      });
      try {
        await projectorStateRepo.recordError(WEB_PUBLIC_CACHE_PROJECTOR, message);
      } catch (recordErr) {
        log.warn({ err: recordErr }, "web_public_cache_record_error_failed");
      }
    }
  }
  await projectorStateRepo.advanceCursor(WEB_PUBLIC_CACHE_PROJECTOR, cursor);
}

function isLagging(rows: readonly { occurredAt?: Date }[], nowMs: number): boolean {
  const oldest = rows[0]?.occurredAt?.getTime();
  return oldest !== undefined && nowMs - oldest >= WEB_PUBLIC_CACHE_LAG_ALERT_MS;
}
