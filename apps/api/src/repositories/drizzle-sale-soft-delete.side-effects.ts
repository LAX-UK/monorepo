import type { Database } from "@auction/db";
import {
  absenteeBid,
  buyerAgentAuthorisation,
  lot,
  lotDocument,
  sale,
  saleDocument,
  saleFollow,
  saleRegistration,
  saleroomSession,
  telephoneBidBooking,
} from "@auction/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { LotError } from "../lib/errors.js";
import type { ILotLifecycleRecorder } from "../services/interfaces/lot-lifecycle-recorder.js";
import type { ISaleSoftDeleteSideEffects } from "../services/interfaces/sale-soft-delete.js";

const WITHDRAWABLE_REGISTRATION_STATUSES = ["pending", "approved"] as const;
const VOIDABLE_ABSENTEE_STATUSES = ["scheduled", "executing"] as const;
const CANCELLABLE_TELEPHONE_STATUSES = ["requested", "confirmed", "in_progress"] as const;
const OPEN_SALEROOM_STATUSES = ["pending", "live", "paused"] as const;

export class DrizzleSaleSoftDeleteSideEffects implements ISaleSoftDeleteSideEffects {
  constructor(
    private readonly db: Database,
    private readonly lotLifecycleRecording: ILotLifecycleRecorder | null = null,
  ) {}

  async softDeleteCascade(input: {
    saleId: string;
    actorUserId: string;
    deletedAt: Date;
    lotIds: string[];
  }): Promise<void> {
    const { saleId, actorUserId, deletedAt, lotIds } = input;

    await this.db.transaction(async (tx) => {
      if (lotIds.length > 0) {
        const lotsBefore = await tx
          .select()
          .from(lot)
          .where(and(eq(lot.saleId, saleId), isNull(lot.deletedAt)));

        await tx
          .update(lot)
          .set({
            deletedAt,
            deletedByUserId: actorUserId,
            updatedAt: deletedAt,
            status: "cancelled",
          })
          .where(and(eq(lot.saleId, saleId), isNull(lot.deletedAt)));

        if (this.lotLifecycleRecording) {
          for (const l of lotsBefore) {
            await this.lotLifecycleRecording.recordCancelled(
              tx,
              {
                id: l.id,
                status: "cancelled",
                saleId: l.saleId,
                sellerLegalEntityId: l.sellerLegalEntityId,
              },
              "sale_soft_delete",
              actorUserId,
            );
          }
        }

        await tx
          .update(lotDocument)
          .set({ deletedAt })
          .where(and(inArray(lotDocument.lotId, lotIds), isNull(lotDocument.deletedAt)));

        await tx
          .update(absenteeBid)
          .set({
            status: "voided",
            cancelledAt: deletedAt,
            cancellationReason: "sale_soft_deleted",
          })
          .where(
            and(
              inArray(absenteeBid.lotId, lotIds),
              inArray(absenteeBid.status, [...VOIDABLE_ABSENTEE_STATUSES]),
            ),
          );
      }

      await tx
        .update(saleDocument)
        .set({ deletedAt })
        .where(and(eq(saleDocument.saleId, saleId), isNull(saleDocument.deletedAt)));

      await tx
        .update(saleRegistration)
        .set({ status: "withdrawn", decidedAt: deletedAt })
        .where(
          and(
            eq(saleRegistration.saleId, saleId),
            inArray(saleRegistration.status, [...WITHDRAWABLE_REGISTRATION_STATUSES]),
          ),
        );

      await tx.delete(saleFollow).where(eq(saleFollow.saleId, saleId));

      await tx
        .update(saleroomSession)
        .set({ status: "ended", endedAt: deletedAt, updatedAt: deletedAt })
        .where(
          and(
            eq(saleroomSession.saleId, saleId),
            inArray(saleroomSession.status, [...OPEN_SALEROOM_STATUSES]),
          ),
        );

      await tx
        .update(telephoneBidBooking)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(telephoneBidBooking.saleId, saleId),
            inArray(telephoneBidBooking.status, [...CANCELLABLE_TELEPHONE_STATUSES]),
          ),
        );

      await tx
        .update(buyerAgentAuthorisation)
        .set({
          status: "revoked",
          revokedAt: deletedAt,
          revokedReason: "sale_soft_deleted",
        })
        .where(
          and(
            eq(buyerAgentAuthorisation.saleId, saleId),
            eq(buyerAgentAuthorisation.status, "active"),
          ),
        );

      const updatedSales = await tx
        .update(sale)
        .set({
          deletedAt,
          deletedByUserId: actorUserId,
          updatedAt: deletedAt,
        })
        .where(and(eq(sale.id, saleId), isNull(sale.deletedAt)))
        .returning({ id: sale.id });
      if (updatedSales.length === 0) {
        throw new LotError("Sale not found", 404);
      }
    });
  }
}
