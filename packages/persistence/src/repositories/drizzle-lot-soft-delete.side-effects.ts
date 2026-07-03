import type { Database } from "@auction/db";
import { absenteeBid, lot, lotDocument } from "@auction/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { ILotCancelledLifecycleRecorder } from "../interfaces/lot-cancelled-lifecycle-recorder.js";
import type { ILotSoftDeleteSideEffects } from "../interfaces/lot-soft-delete.js";
import { LotError } from "../lib/lot.error.js";

const VOIDABLE_ABSENTEE_STATUSES = ["scheduled", "executing"] as const;

export class DrizzleLotSoftDeleteSideEffects implements ILotSoftDeleteSideEffects {
  constructor(
    private readonly db: Database,
    private readonly lotLifecycleRecording: ILotCancelledLifecycleRecorder | null = null,
  ) {}

  async softDeleteLot(input: {
    lotId: string;
    actorUserId: string;
    deletedAt: Date;
  }): Promise<void> {
    const { lotId, actorUserId, deletedAt } = input;

    await this.db.transaction(async (tx) => {
      const [lotBefore] = await tx
        .select()
        .from(lot)
        .where(and(eq(lot.id, lotId), isNull(lot.deletedAt)))
        .limit(1);
      if (!lotBefore) {
        throw new LotError("Lot not found", 404);
      }

      const updatedLots = await tx
        .update(lot)
        .set({
          deletedAt,
          deletedByUserId: actorUserId,
          updatedAt: deletedAt,
          status: "cancelled",
        })
        .where(and(eq(lot.id, lotId), isNull(lot.deletedAt)))
        .returning({ id: lot.id });
      if (updatedLots.length === 0) {
        throw new LotError("Lot not found", 404);
      }

      if (this.lotLifecycleRecording) {
        await this.lotLifecycleRecording.recordCancelled(
          tx,
          {
            id: lotBefore.id,
            status: "cancelled",
            saleId: lotBefore.saleId,
            sellerLegalEntityId: lotBefore.sellerLegalEntityId,
          },
          "soft_delete",
          actorUserId,
        );
      }

      await tx
        .update(lotDocument)
        .set({ deletedAt })
        .where(and(eq(lotDocument.lotId, lotId), isNull(lotDocument.deletedAt)));

      await tx
        .update(absenteeBid)
        .set({
          status: "voided",
          cancelledAt: deletedAt,
          cancellationReason: "lot_soft_deleted",
        })
        .where(
          and(
            eq(absenteeBid.lotId, lotId),
            inArray(absenteeBid.status, [...VOIDABLE_ABSENTEE_STATUSES]),
          ),
        );
    });
  }
}
