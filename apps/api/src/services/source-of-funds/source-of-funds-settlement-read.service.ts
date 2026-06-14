import type { Database } from "@auction/db";
import { lot, payment, sale } from "@auction/db/schema";
import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import { computeLotCheckoutPricing } from "../../lib/lot-checkout-pricing.js";
import { mapLotRow, mapSaleRow } from "../../lib/mappers.js";
import { ACTIVE_BUYER_SETTLEMENT_PAYMENT_STATUSES } from "./active-settlement-statuses.js";

export type SourceOfFundsSettlementItem = {
  kind: "payment" | "won_unpaid";
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  saleId: string;
  saleTitle: string;
  amountPence: number;
  paymentId?: string;
  paymentStatus?: string;
};

export type SourceOfFundsSettlementSummary = {
  settlementSummary: string | null;
  settlementItemCount: number;
};

function majorAmountToPence(amount: string | null | undefined): number {
  const n = Number.parseFloat(String(amount ?? "").trim());
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function buildSummaryFromItems(
  items: SourceOfFundsSettlementItem[],
): SourceOfFundsSettlementSummary {
  if (items.length === 0) {
    return { settlementSummary: null, settlementItemCount: 0 };
  }
  const top = items[0];
  if (!top) {
    return { settlementSummary: null, settlementItemCount: 0 };
  }
  const lotRef = top.lotNumber == null ? top.lotTitle : `Lot ${top.lotNumber}`;
  const base = `${lotRef} · ${top.saleTitle}`;
  const suffix = items.length > 1 ? ` (+${items.length - 1} more)` : "";
  return { settlementSummary: `${base}${suffix}`, settlementItemCount: items.length };
}

export class SourceOfFundsSettlementReadService {
  constructor(private readonly db: Database) {}

  async listSettlementItemsForBuyer(userId: string): Promise<SourceOfFundsSettlementItem[]> {
    const paymentRows = await this.db
      .select({
        paymentId: payment.id,
        paymentStatus: payment.status,
        amount: payment.amount,
        lotId: lot.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        saleId: sale.id,
        saleTitle: sale.title,
      })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .innerJoin(sale, eq(lot.saleId, sale.id))
      .where(
        and(
          eq(payment.buyerId, userId),
          inArray(payment.status, [...ACTIVE_BUYER_SETTLEMENT_PAYMENT_STATUSES]),
        ),
      );

    const paymentItems: SourceOfFundsSettlementItem[] = paymentRows.map((row) => ({
      kind: "payment" as const,
      lotId: row.lotId,
      lotTitle: row.lotTitle,
      lotNumber: row.lotNumber ?? null,
      saleId: row.saleId,
      saleTitle: row.saleTitle,
      amountPence: majorAmountToPence(row.amount),
      paymentId: row.paymentId,
      paymentStatus: row.paymentStatus,
    }));

    const wonUnpaidRows = await this.db
      .select({
        lotRow: lot,
        saleRow: sale,
      })
      .from(lot)
      .innerJoin(sale, eq(lot.saleId, sale.id))
      .where(
        and(
          eq(lot.winnerId, userId),
          notExists(
            this.db.select({ id: payment.id }).from(payment).where(eq(payment.lotId, lot.id)),
          ),
        ),
      );

    const wonUnpaidItems: SourceOfFundsSettlementItem[] = wonUnpaidRows.map((row) => {
      const mappedLot = mapLotRow(row.lotRow);
      const mappedSale = mapSaleRow(row.saleRow);
      const pricing = computeLotCheckoutPricing(mappedLot, mappedSale);
      return {
        kind: "won_unpaid" as const,
        lotId: mappedLot.id,
        lotTitle: mappedLot.title,
        lotNumber: mappedLot.lotNumber ?? null,
        saleId: mappedSale.id,
        saleTitle: mappedSale.title,
        amountPence: majorAmountToPence(pricing.totalMajor),
      };
    });

    return [...paymentItems, ...wonUnpaidItems].sort((a, b) => b.amountPence - a.amountPence);
  }

  /** Batch summaries using two SQL queries (payments + won-unpaid) instead of per-user round trips. */
  async summarizeForBuyersBatch(
    userIds: readonly string[],
  ): Promise<Map<string, SourceOfFundsSettlementSummary>> {
    const out = new Map<string, SourceOfFundsSettlementSummary>();
    if (userIds.length === 0) return out;

    const uniqueIds = [...new Set(userIds)];
    for (const userId of uniqueIds) {
      out.set(userId, { settlementSummary: null, settlementItemCount: 0 });
    }

    const paymentRows = await this.db
      .select({
        buyerId: payment.buyerId,
        amount: payment.amount,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        saleTitle: sale.title,
      })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .innerJoin(sale, eq(lot.saleId, sale.id))
      .where(
        and(
          inArray(payment.buyerId, uniqueIds),
          inArray(payment.status, [...ACTIVE_BUYER_SETTLEMENT_PAYMENT_STATUSES]),
        ),
      );

    const wonUnpaidRows = await this.db
      .select({
        winnerId: lot.winnerId,
        lotRow: lot,
        saleRow: sale,
      })
      .from(lot)
      .innerJoin(sale, eq(lot.saleId, sale.id))
      .where(
        and(
          inArray(lot.winnerId, uniqueIds),
          notExists(
            this.db.select({ id: payment.id }).from(payment).where(eq(payment.lotId, lot.id)),
          ),
        ),
      );

    const itemsByUser = new Map<string, SourceOfFundsSettlementItem[]>();

    for (const row of paymentRows) {
      const list = itemsByUser.get(row.buyerId) ?? [];
      list.push({
        kind: "payment",
        lotId: "",
        lotTitle: row.lotTitle,
        lotNumber: row.lotNumber ?? null,
        saleId: "",
        saleTitle: row.saleTitle,
        amountPence: majorAmountToPence(row.amount),
      });
      itemsByUser.set(row.buyerId, list);
    }

    for (const row of wonUnpaidRows) {
      if (!row.winnerId) continue;
      const mappedLot = mapLotRow(row.lotRow);
      const mappedSale = mapSaleRow(row.saleRow);
      const pricing = computeLotCheckoutPricing(mappedLot, mappedSale);
      const list = itemsByUser.get(row.winnerId) ?? [];
      list.push({
        kind: "won_unpaid",
        lotId: mappedLot.id,
        lotTitle: mappedLot.title,
        lotNumber: mappedLot.lotNumber ?? null,
        saleId: mappedSale.id,
        saleTitle: mappedSale.title,
        amountPence: majorAmountToPence(pricing.totalMajor),
      });
      itemsByUser.set(row.winnerId, list);
    }

    for (const userId of uniqueIds) {
      const items = (itemsByUser.get(userId) ?? []).sort((a, b) => b.amountPence - a.amountPence);
      out.set(userId, buildSummaryFromItems(items));
    }

    return out;
  }

  async sumActivePaymentExposurePence(userId: string): Promise<number> {
    const [row] = await this.db
      .select({
        totalPence: sql<number>`COALESCE(ROUND(SUM(${payment.amount}) * 100), 0)::bigint`,
      })
      .from(payment)
      .where(
        and(
          eq(payment.buyerId, userId),
          inArray(payment.status, [...ACTIVE_BUYER_SETTLEMENT_PAYMENT_STATUSES]),
        ),
      );
    return Number(row?.totalPence ?? 0);
  }

  async listBlockedPaymentsForBuyer(userId: string): Promise<
    Array<{
      paymentId: string;
      lotId: string;
      lotTitle: string;
      lotNumber: number | null;
    }>
  > {
    const rows = await this.db
      .select({
        paymentId: payment.id,
        lotId: lot.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
      })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .where(and(eq(payment.buyerId, userId), eq(payment.status, "requires_manual_review")));
    return rows.map((r) => ({
      paymentId: r.paymentId,
      lotId: r.lotId,
      lotTitle: r.lotTitle,
      lotNumber: r.lotNumber ?? null,
    }));
  }
}

export function buildSettlementSummaryLabel(
  items: readonly SourceOfFundsSettlementItem[],
): SourceOfFundsSettlementSummary {
  return buildSummaryFromItems([...items]);
}
