import type { Database } from "@auction/db";
import {
  absenteeBid,
  bid,
  buyerAgentAuthorisation,
  lot,
  lotDocument,
  payment,
  sale,
  saleDocument,
  saleFollow,
  saleRegistration,
  saleroomSession,
  telephoneBidBooking,
} from "@auction/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { LotError } from "../lib/errors.js";
import type {
  ISaleSoftDeleteSideEffects,
  SaleSoftDeleteGuardCounts,
} from "../services/interfaces/sale-soft-delete.js";
import type { LotLifecycleRecording } from "../services/lot-lifecycle-recording.service.js";

const WITHDRAWABLE_REGISTRATION_STATUSES = ["pending", "approved"] as const;
const VOIDABLE_ABSENTEE_STATUSES = ["scheduled", "executing"] as const;
const CANCELLABLE_TELEPHONE_STATUSES = ["requested", "confirmed", "in_progress"] as const;
const OPEN_SALEROOM_STATUSES = ["pending", "live", "paused"] as const;

export class DrizzleSaleSoftDeleteSideEffects implements ISaleSoftDeleteSideEffects {
  constructor(
    private readonly db: Database,
    private readonly lotLifecycleRecording: LotLifecycleRecording | null = null,
  ) {}

  async countGuardsForSale(saleId: string): Promise<SaleSoftDeleteGuardCounts> {
    const [bidRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(bid)
      .innerJoin(lot, eq(bid.lotId, lot.id))
      .where(and(eq(lot.saleId, saleId), isNull(lot.deletedAt)));

    const [paymentRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .where(and(eq(lot.saleId, saleId), isNull(lot.deletedAt)));

    const [regRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(saleRegistration)
      .where(and(eq(saleRegistration.saleId, saleId), eq(saleRegistration.status, "approved")));

    return {
      bidCount: bidRow?.n ?? 0,
      paymentCount: paymentRow?.n ?? 0,
      approvedRegistrationCount: regRow?.n ?? 0,
    };
  }

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
