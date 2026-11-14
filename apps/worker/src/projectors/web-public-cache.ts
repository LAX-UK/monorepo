import type { WebPublicCacheInvalidator } from "@auction/background-runtime";
import {
  PUBLIC_PAGE_EVENT_TYPES,
  publicPageLotEventNeedsSaleLookup,
  publicPageTagsForDomainEvent,
} from "@auction/domain";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const WEB_PUBLIC_CACHE_PROJECTOR = "web_public_cache";

const BATCH_SIZE = 200;

/** What the projector needs besides the shared cursor and event reader. */
export type WebPublicCacheDeps = {
  invalidator: WebPublicCacheInvalidator;
  /** The lot's current sale, for lot events whose payload names none (a cancellation). */
  lotSaleId(lotId: string): Promise<string | null>;
  /** The newest domain event id: a first run starts here instead of replaying history. */
  latestEventId(): Promise<number>;
};

/**
 * After a committed change to a lot or a sale, asks the web app to drop the cached public reads
 * that show it (`POST /api/revalidate`), so the public sale and lot pages are never stale on a
 * status, a close time, a withdrawal or a publication. A batch is sent as one request; when the
 * web app cannot be reached the cursor stays and the batch is sent again on the next tick (the
 * cached reads still expire on their own window meanwhile).
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
  for (const row of rows) {
    const event = { eventType: row.eventType, aggregateId: row.aggregateId, payload: row.payload };
    const lotSaleId = publicPageLotEventNeedsSaleLookup(event)
      ? await deps.lotSaleId(row.aggregateId).catch(() => null)
      : null;
    for (const tag of publicPageTagsForDomainEvent(event, { lotSaleId })) tags.add(tag);
    cursor = Math.max(cursor, row.id);
  }

  try {
    await deps.invalidator.invalidate([...tags]);
  } catch (err) {
    log.warn({ err, events: rows.length }, "web_public_cache_invalidate_failed");
    return;
  }
  await projectorStateRepo.advanceCursor(WEB_PUBLIC_CACHE_PROJECTOR, cursor);
}
