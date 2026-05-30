import type { Database } from "@auction/db";
import { absenteeBid, bid, lot, lotDocument, payment, saleRegistration } from "@auction/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { LotError } from "../lib/errors.js";
import type {
  ILotSoftDeleteSideEffects,
  LotSoftDeleteGuardCounts,
} from "../services/interfaces/lot-soft-delete.js";
import type { LotLifecycleRecording } from "../services/lot-lifecycle-recording.service.js";

const VOIDABLE_ABSENTEE_STATUSES = ["scheduled", "executing"] as const;

function emptyLotGuardCounts(): LotSoftDeleteGuardCounts {
  return { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 };
}

export class DrizzleLotSoftDeleteSideEffects implements ILotSoftDeleteSideEffects {
  constructor(
    private readonly db: Database,
    private readonly lotLifecycleRecording: LotLifecycleRecording | null = null,
  ) {}

  async countGuardsForLot(lotId: string, saleId: string | null): Promise<LotSoftDeleteGuardCounts> {
    const [bidRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(bid)
      .where(eq(bid.lotId, lotId));

    const [paymentRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(payment)
      .where(eq(payment.lotId, lotId));

    let approvedRegistrationCount = 0;
    if (saleId) {
      const [regRow] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(saleRegistration)
        .where(and(eq(saleRegistration.saleId, saleId), eq(saleRegistration.status, "approved")));
      approvedRegistrationCount = regRow?.n ?? 0;
    }

    return {
      bidCount: bidRow?.n ?? 0,
      paymentCount: paymentRow?.n ?? 0,
      approvedRegistrationCount,
    };
  }

  async countGuardsForLots(
    lots: Array<{ lotId: string; saleId: string | null }>,
  ): Promise<Map<string, LotSoftDeleteGuardCounts>> {
    const map = new Map<string, LotSoftDeleteGuardCounts>();
    const lotIds = lots.map((l) => l.lotId);
    for (const id of lotIds) {
      map.set(id, emptyLotGuardCounts());
    }
    if (lotIds.length === 0) return map;

    const bidRows = await this.db
      .select({ lotId: bid.lotId, n: sql<number>`count(*)::int` })
      .from(bid)
      .where(inArray(bid.lotId, lotIds))
      .groupBy(bid.lotId);

    const paymentRows = await this.db
      .select({ lotId: payment.lotId, n: sql<number>`count(*)::int` })
      .from(payment)
      .where(inArray(payment.lotId, lotIds))
      .groupBy(payment.lotId);

    for (const row of bidRows) {
      const current = map.get(row.lotId) ?? emptyLotGuardCounts();
      map.set(row.lotId, { ...current, bidCount: row.n ?? 0 });
    }
    for (const row of paymentRows) {
      const current = map.get(row.lotId) ?? emptyLotGuardCounts();
      map.set(row.lotId, { ...current, paymentCount: row.n ?? 0 });
    }

    const saleIds = [
      ...new Set(lots.map((l) => l.saleId).filter((id): id is string => id != null)),
    ];
    const regBySale = new Map<string, number>();
    if (saleIds.length > 0) {
      const regRows = await this.db
        .select({ saleId: saleRegistration.saleId, n: sql<number>`count(*)::int` })
        .from(saleRegistration)
        .where(
          and(inArray(saleRegistration.saleId, saleIds), eq(saleRegistration.status, "approved")),
        )
        .groupBy(saleRegistration.saleId);
      for (const row of regRows) {
        regBySale.set(row.saleId, row.n ?? 0);
      }
    }

    for (const { lotId, saleId } of lots) {
      if (!saleId) continue;
      const regCount = regBySale.get(saleId) ?? 0;
      const current = map.get(lotId) ?? emptyLotGuardCounts();
      map.set(lotId, { ...current, approvedRegistrationCount: regCount });
    }

    return map;
  }

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
