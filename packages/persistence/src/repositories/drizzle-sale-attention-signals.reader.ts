import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import {
  bid,
  conditionReportRequest,
  lot,
  lotFulfilment,
  payment,
  sale,
  saleRegistration,
  telephoneBidBooking,
} from "@auction/db/schema";
import type { SaleAttentionSignalKey, SaleAttentionSignals } from "@auction/domain";
import { listSaleSoftDeleteBlockers } from "@auction/domain";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { ISaleAttentionSignalsReader } from "../interfaces/sale-attention-signals.reader.js";
import { mapSaleRow } from "../lib/entity-row-mappers.js";
import { findLotsBySaleId } from "./lot/lot-catalog-queries.js";

const STALE_PAYMENT_HOURS = 48;
const OPEN_CONDITION_STATUSES = ["pending", "in_progress"] as const;
const FULFILMENT_STATUSES = [
  "awaiting_payment",
  "awaiting_release",
  "ready_for_collection",
  "released",
  "in_transit",
] as const;

function needsKey(needs: readonly SaleAttentionSignalKey[], key: SaleAttentionSignalKey): boolean {
  return needs.includes(key);
}

export class DrizzleSaleAttentionSignalsReader implements ISaleAttentionSignalsReader {
  constructor(private readonly db: Database) {}

  async load(
    saleId: string,
    needs: readonly SaleAttentionSignalKey[],
  ): Promise<SaleAttentionSignals> {
    const [saleRow] = await this.db
      .select()
      .from(sale)
      .where(and(eq(sale.id, saleId), saleNotDeleted()))
      .limit(1);

    if (!saleRow) {
      return { notFound: true };
    }

    const signals: SaleAttentionSignals = {};

    if (needsKey(needs, "sale")) {
      signals.sale = mapSaleRow(saleRow, []);
    }

    const needsLots =
      needsKey(needs, "lots") ||
      needsKey(needs, "connectByLotId") ||
      needsKey(needs, "deleteGuards");

    let mappedLots: Awaited<ReturnType<typeof findLotsBySaleId>> = [];
    if (needsLots) {
      mappedLots = await findLotsBySaleId(this.db, saleId);
      if (needsKey(needs, "lots") || needsKey(needs, "connectByLotId")) {
        signals.lots = mappedLots.map((l) => ({
          id: l.id,
          title: l.title,
          status: l.status,
          images: l.images,
          description: l.description,
          sellerLegalEntityId: l.sellerLegalEntityId ?? "",
          artistReviewRequired: l.artistReviewRequired ?? false,
          saleId: l.saleId,
          startTime: l.startTime,
          endTime: l.endTime,
          winnerId: l.winnerId ?? null,
          deletedAt: l.deletedAt ?? null,
        }));
      }
    }

    if (needsKey(needs, "registrations") || needsKey(needs, "pendingRegistrationCount")) {
      const regRows = await this.db
        .select({
          id: saleRegistration.id,
          status: saleRegistration.status,
          paddleNumber: saleRegistration.paddleNumber,
          checkedInAt: saleRegistration.checkedInAt,
        })
        .from(saleRegistration)
        .where(eq(saleRegistration.saleId, saleId));

      signals.registrations = regRows.map((r) => ({
        id: r.id,
        status: r.status,
        paddleNumber: r.paddleNumber,
        checkedInAt: r.checkedInAt?.toISOString() ?? null,
        kycStatus: null,
      }));
      signals.pendingRegistrationCount = regRows.filter((r) => r.status === "pending").length;
    }

    if (needsKey(needs, "telephoneBookings")) {
      const [row] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(telephoneBidBooking)
        .where(
          and(eq(telephoneBidBooking.saleId, saleId), eq(telephoneBidBooking.status, "requested")),
        );
      signals.telephoneRequestedCount = row?.n ?? 0;
    }

    if (needsKey(needs, "deleteGuards")) {
      const guards = await this.loadDeleteGuards(saleId);
      const saleEntity = signals.sale ?? mapSaleRow(saleRow, []);
      signals.deleteBlockers = listSaleSoftDeleteBlockers({
        sale: saleEntity,
        lots: mappedLots,
        guards,
      });
    }

    if (needsKey(needs, "settlement")) {
      const [unsettled] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(lot)
        .where(
          and(
            eq(lot.saleId, saleId),
            lotNotDeleted(),
            eq(lot.status, "ended"),
            sql`${lot.winnerId} is not null`,
            sql`not exists (
              select 1 from ${payment} p
              where p.lot_id = ${lot.id}
                and p.status in ('captured', 'refunded')
            )`,
          ),
        );
      signals.unsettledSoldLotCount = unsettled?.n ?? 0;

      const staleCutoff = new Date(Date.now() - STALE_PAYMENT_HOURS * 60 * 60_000);
      const [stale] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(payment)
        .innerJoin(lot, eq(payment.lotId, lot.id))
        .where(
          and(
            eq(lot.saleId, saleId),
            lotNotDeleted(),
            inArray(payment.status, ["pending", "authorized"]),
            lt(payment.createdAt, staleCutoff),
          ),
        );
      signals.stalePaymentCount = stale?.n ?? 0;
    }

    if (needsKey(needs, "fulfilment")) {
      const [row] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(lotFulfilment)
        .innerJoin(lot, eq(lotFulfilment.lotId, lot.id))
        .where(
          and(
            eq(lot.saleId, saleId),
            lotNotDeleted(),
            inArray(lotFulfilment.status, [...FULFILMENT_STATUSES]),
          ),
        );
      signals.fulfilmentPendingCount = row?.n ?? 0;
    }

    if (needsKey(needs, "conditionReports")) {
      const [row] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(conditionReportRequest)
        .innerJoin(lot, eq(conditionReportRequest.lotId, lot.id))
        .where(
          and(
            eq(lot.saleId, saleId),
            lotNotDeleted(),
            inArray(conditionReportRequest.status, [...OPEN_CONDITION_STATUSES]),
          ),
        );
      signals.openConditionReportCount = row?.n ?? 0;
    }

    if (needsKey(needs, "finance")) {
      const [row] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(payment)
        .innerJoin(lot, eq(payment.lotId, lot.id))
        .where(
          and(
            eq(lot.saleId, saleId),
            lotNotDeleted(),
            eq(payment.status, "requires_manual_review"),
          ),
        );
      signals.financeReviewCount = row?.n ?? 0;
    }

    if (needsKey(needs, "saleroomSession")) {
      signals.saleroomNeedsClosing = false;
    }

    if (mappedLots.length > 0) {
      const now = new Date();
      const { evaluateLotReadiness } = await import("@auction/domain");
      let incomplete = 0;
      for (const l of mappedLots) {
        if (l.status === "cancelled" || l.status === "voided") continue;
        const readiness = evaluateLotReadiness(l);
        if (readiness.percent < 100) incomplete += 1;
      }
      signals.incompleteCatalogLotCount = incomplete;
      signals.draftLotsMissingPhotosCount = mappedLots.filter(
        (l) => l.status === "draft" && l.images.length === 0,
      ).length;
      signals.draftLotsPastStartCount = mappedLots.filter(
        (l) => l.status === "draft" && l.startTime < now,
      ).length;
      signals.returnToInventoryEligibleCount = mappedLots.filter(
        (l) =>
          (l.status === "ended" || l.status === "cancelled" || l.status === "voided") &&
          !l.winnerId,
      ).length;
    }

    return signals;
  }

  private async loadDeleteGuards(saleId: string) {
    const [bidRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(bid)
      .innerJoin(lot, eq(bid.lotId, lot.id))
      .where(and(eq(lot.saleId, saleId), lotNotDeleted()));

    const [paymentRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .where(and(eq(lot.saleId, saleId), lotNotDeleted()));

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
}
