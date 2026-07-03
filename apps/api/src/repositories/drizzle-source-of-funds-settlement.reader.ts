import type { Database } from "@auction/db";
import { lot, payment, sale } from "@auction/db/schema";
import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import type { ISourceOfFundsSettlementReader } from "./interfaces/source-of-funds-settlement.reader.js";
import { ACTIVE_BUYER_SETTLEMENT_PAYMENT_STATUSES } from "./source-of-funds-settlement.types.js";

export class DrizzleSourceOfFundsSettlementReader implements ISourceOfFundsSettlementReader {
  constructor(private readonly db: Database) {}

  async fetchActivePaymentSettlementRows(userId: string) {
    return this.db
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
  }

  async fetchWonUnpaidLotSaleRows(userId: string) {
    return this.db
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
  }

  async fetchBatchPaymentSettlementRows(userIds: readonly string[]) {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return [];
    return this.db
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
  }

  async fetchBatchWonUnpaidLotSaleRows(userIds: readonly string[]) {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return [];
    return this.db
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

  async fetchBlockedPaymentsForBuyer(userId: string) {
    return this.db
      .select({
        paymentId: payment.id,
        lotId: lot.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
      })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .where(and(eq(payment.buyerId, userId), eq(payment.status, "requires_manual_review")));
  }
}
