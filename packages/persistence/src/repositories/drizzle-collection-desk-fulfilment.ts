import { collectionBookingLot, lotFulfilment } from "@auction/db/schema";
import { HAND_OVER_FROM_STATUSES, isHandOverFromStatus } from "@auction/domain";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { DbTransaction } from "../interfaces/artist-delete.repository.js";
import type {
  DeskFulfilmentMoveResult,
  DeskHandOverMove,
  ICollectionDeskFulfilment,
} from "../interfaces/collection-desk-fulfilment.js";

/**
 * The desk's fulfilment moves, inside the booking's transaction. Each lot is locked first so two
 * actions on the same lot (two desks, or the desk and Lot fulfilment) take turns, and each update
 * names the status it expects, so a lot another action has moved is refused rather than overwritten.
 */
export class DrizzleCollectionDeskFulfilment implements ICollectionDeskFulfilment {
  async handOver(tx: DbTransaction, move: DeskHandOverMove): Promise<DeskFulfilmentMoveResult> {
    const lotIds = [...new Set(move.lotIds)];
    const rows = await tx
      .select({ lotId: lotFulfilment.lotId, status: lotFulfilment.status })
      .from(lotFulfilment)
      .where(inArray(lotFulfilment.lotId, lotIds))
      .for("update");
    const byLot = new Map(rows.map((row) => [row.lotId, row.status]));
    for (const lotId of lotIds) {
      if (!isHandOverFromStatus(byLot.get(lotId))) return { ok: false, lotId };
    }
    for (const lotId of lotIds) {
      const previous = byLot.get(lotId);
      const moved = await tx
        .update(lotFulfilment)
        .set({
          status: "delivered",
          fulfilmentMethod: "collection",
          collectedBy: move.collectedBy,
          collectedByUserId: move.actorUserId,
          collectedAt: move.at,
          updatedAt: move.at,
        })
        .where(
          and(
            eq(lotFulfilment.lotId, lotId),
            inArray(lotFulfilment.status, [...HAND_OVER_FROM_STATUSES]),
          ),
        )
        .returning({ lotId: lotFulfilment.lotId });
      if (moved.length !== 1) return { ok: false, lotId };
      await tx
        .update(collectionBookingLot)
        .set({ previousFulfilmentStatus: previous ?? null })
        .where(
          and(
            eq(collectionBookingLot.bookingId, move.bookingId),
            eq(collectionBookingLot.lotId, lotId),
          ),
        );
    }
    return { ok: true };
  }

  async undoHandOver(tx: DbTransaction, bookingId: string): Promise<DeskFulfilmentMoveResult> {
    const handed = await tx
      .select({
        lotId: collectionBookingLot.lotId,
        previous: collectionBookingLot.previousFulfilmentStatus,
      })
      .from(collectionBookingLot)
      .where(
        and(
          eq(collectionBookingLot.bookingId, bookingId),
          isNotNull(collectionBookingLot.previousFulfilmentStatus),
        ),
      );
    if (handed.length === 0) return { ok: true };
    await tx
      .select({ lotId: lotFulfilment.lotId })
      .from(lotFulfilment)
      .where(
        inArray(
          lotFulfilment.lotId,
          handed.map((row) => row.lotId),
        ),
      )
      .for("update");
    for (const { lotId, previous } of handed) {
      if (!isHandOverFromStatus(previous)) return { ok: false, lotId };
      const restored = await tx
        .update(lotFulfilment)
        .set({
          status: previous,
          collectedBy: null,
          collectedByUserId: null,
          collectedAt: null,
          updatedAt: new Date(),
        })
        .where(and(eq(lotFulfilment.lotId, lotId), eq(lotFulfilment.status, "delivered")))
        .returning({ lotId: lotFulfilment.lotId });
      if (restored.length !== 1) return { ok: false, lotId };
    }
    await tx
      .update(collectionBookingLot)
      .set({ previousFulfilmentStatus: null })
      .where(eq(collectionBookingLot.bookingId, bookingId));
    return { ok: true };
  }
}
