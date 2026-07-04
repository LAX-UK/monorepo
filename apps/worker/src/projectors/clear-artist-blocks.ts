import type { IClearArtistBlocksRepository } from "../interfaces/clear-artist-blocks.repository.js";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const PROJECTOR_NAME = "clear_artist_blocks";

type ReviewedPayload = {
  decision?: string;
};

type MergedPayload = {
  intoArtistId?: string;
};

/** Domain logic tested independently — projector wires repository operations here. */
export async function applyClearArtistBlocksEvent(
  repo: IClearArtistBlocksRepository,
  row: { id: number; eventType: string; aggregateId: string; payload: unknown },
): Promise<void> {
  const { eventType, aggregateId, payload } = row;

  if (eventType === "artist.approved") {
    await repo.clearLotsArtistReviewRequired(aggregateId);
    return;
  }

  if (eventType === "artist.reviewed") {
    const p = payload as ReviewedPayload;
    if (p.decision === "approved") {
      await repo.clearLotsArtistReviewRequired(aggregateId);
    }
    return;
  }

  if (eventType === "artist.merged") {
    const p = payload as MergedPayload;
    const intoId = p.intoArtistId;
    if (!intoId) return;
    const status = await repo.getArtistStatus(intoId);
    if (status === "approved") {
      await repo.clearLotsArtistReviewRequired(intoId);
    }
  }
}

export async function processClearArtistBlocks(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
}): Promise<void> {
  const { ctx, log } = options;
  const { projectorStateRepo, domainEventReader, clearArtistBlocksRepo } = ctx;

  const cursor = await projectorStateRepo.getCursor(PROJECTOR_NAME);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["artist.reviewed", "artist.merged", "artist.approved"],
    limit: 100,
  });

  if (rows.length === 0) {
    return;
  }

  let maxId = cursor;
  for (const row of rows) {
    try {
      await applyClearArtistBlocksEvent(clearArtistBlocksRepo, {
        id: row.id,
        eventType: row.eventType,
        aggregateId: row.aggregateId,
        payload: row.payload,
      });
      maxId = row.id;
    } catch (err) {
      log.error({ err, eventId: row.id, eventType: row.eventType }, "clear_artist_blocks_failed");
      return;
    }
  }

  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(PROJECTOR_NAME, maxId);
  }
}
