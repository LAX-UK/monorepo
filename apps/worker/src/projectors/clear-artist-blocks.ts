import { artistProfile, domainEvent, lot, projectorState } from "@auction/db/schema";
import { and, eq, gt, inArray } from "drizzle-orm";
import type pino from "pino";

const PROJECTOR_NAME = "clear_artist_blocks";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type ReviewedPayload = {
  decision?: string;
};

type MergedPayload = {
  intoArtistId?: string;
};

/** Domain logic tested independently — projector wires DB operations here. */
export async function applyClearArtistBlocksEvent(
  db: Db,
  row: { id: number; eventType: string; aggregateId: string; payload: unknown },
): Promise<void> {
  const { eventType, aggregateId, payload } = row;

  if (eventType === "artist.approved") {
    await clearLotsForApprovedArtist(db, aggregateId);
    return;
  }

  if (eventType === "artist.reviewed") {
    const p = payload as ReviewedPayload;
    if (p.decision === "approved") {
      await clearLotsForApprovedArtist(db, aggregateId);
    }
    return;
  }

  if (eventType === "artist.merged") {
    const p = payload as MergedPayload;
    const intoId = p.intoArtistId;
    if (!intoId) return;
    const [canon] = await db
      .select({ status: artistProfile.status })
      .from(artistProfile)
      .where(eq(artistProfile.id, intoId))
      .limit(1);
    if (canon?.status === "approved") {
      await clearLotsForApprovedArtist(db, intoId);
    }
  }
}

async function clearLotsForApprovedArtist(db: Db, artistId: string): Promise<void> {
  await db
    .update(lot)
    .set({ artistReviewRequired: false })
    .where(and(eq(lot.artistId, artistId), eq(lot.artistReviewRequired, true)));
}

export async function processClearArtistBlocks(options: { db: Db; log: pino.Logger }): Promise<void> {
  const { db, log } = options;

  await db
    .insert(projectorState)
    .values({ projectorName: PROJECTOR_NAME, lastProcessedEventId: 0 })
    .onConflictDoNothing();

  const [cursorRow] = await db
    .select({ last: projectorState.lastProcessedEventId })
    .from(projectorState)
    .where(eq(projectorState.projectorName, PROJECTOR_NAME))
    .limit(1);
  const cursor = cursorRow?.last ?? 0;

  const rows = await db
    .select({
      id: domainEvent.id,
      eventType: domainEvent.eventType,
      aggregateId: domainEvent.aggregateId,
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(
      and(
        gt(domainEvent.id, cursor),
        inArray(domainEvent.eventType, ["artist.reviewed", "artist.merged", "artist.approved"]),
      ),
    )
    .orderBy(domainEvent.id)
    .limit(100);

  if (rows.length === 0) {
    return;
  }

  let maxId = cursor;
  for (const row of rows) {
    try {
      await applyClearArtistBlocksEvent(db, {
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
    await db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, PROJECTOR_NAME));
  }
}
