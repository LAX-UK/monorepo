import { computeLotCheckoutPricing } from "../../lib/lot-checkout-pricing.js";
import { mapLotRow, mapSaleRow } from "../../lib/mappers.js";
import type { ISourceOfFundsSettlementReader } from "../../repositories/interfaces/source-of-funds-settlement.reader.js";

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
  constructor(private readonly reader: ISourceOfFundsSettlementReader) {}

  async listSettlementItemsForBuyer(userId: string): Promise<SourceOfFundsSettlementItem[]> {
    const [paymentRows, wonUnpaidRows] = await Promise.all([
      this.reader.fetchActivePaymentSettlementRows(userId),
      this.reader.fetchWonUnpaidLotSaleRows(userId),
    ]);

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

    const [paymentRows, wonUnpaidRows] = await Promise.all([
      this.reader.fetchBatchPaymentSettlementRows(uniqueIds),
      this.reader.fetchBatchWonUnpaidLotSaleRows(uniqueIds),
    ]);

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
    return this.reader.sumActivePaymentExposurePence(userId);
  }

  async listBlockedPaymentsForBuyer(userId: string): Promise<
    Array<{
      paymentId: string;
      lotId: string;
      lotTitle: string;
      lotNumber: number | null;
    }>
  > {
    const rows = await this.reader.fetchBlockedPaymentsForBuyer(userId);
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
