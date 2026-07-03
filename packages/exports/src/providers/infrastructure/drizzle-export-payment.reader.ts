import type { Database } from "@auction/db";
import { payment, paymentExternalRef } from "@auction/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type {
  IPaymentWriteRepository,
  ListPaymentsExportFilter,
  PaymentRecord,
} from "../ports/payment-write.js";

type Row = InferSelectModel<typeof payment>;

function exportWhere(filter: ListPaymentsExportFilter) {
  const conditions = [];
  if (filter.manualReview === true) {
    conditions.push(eq(payment.status, "requires_manual_review"));
  } else if (filter.status) {
    conditions.push(eq(payment.status, filter.status));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function mapRow(
  row: Row,
  xero?: {
    xeroInvoiceNumber: string | null;
    xeroOnlineInvoiceUrl: string | null;
    xeroSyncStatus: "pending_sync" | "synced" | "error" | null;
    xeroLastError: string | null;
  } | null,
): PaymentRecord {
  return {
    id: row.id,
    lotId: row.lotId,
    paidByUserId: row.buyerId,
    buyerLegalEntityId: row.buyerLegalEntityId ?? "",
    sellerLegalEntityId: row.sellerLegalEntityId ?? "",
    amount: String(row.amount),
    platformFee: String(row.platformFee),
    stripePaymentIntentId: row.stripePaymentIntentId,
    stripeChargeId: row.stripeChargeId,
    stripeRefundId: row.stripeRefundId,
    status: row.status,
    createdAt: row.createdAt,
    xeroInvoiceNumber: xero?.xeroInvoiceNumber ?? null,
    xeroOnlineInvoiceUrl: xero?.xeroOnlineInvoiceUrl ?? null,
    xeroSyncStatus: xero?.xeroSyncStatus ?? null,
    xeroLastError: xero?.xeroLastError ?? null,
  };
}

export class DrizzleExportPaymentReader
  implements Pick<IPaymentWriteRepository, "listForExport" | "countForExport">
{
  constructor(private readonly db: Database) {}

  async listForExport(
    filter: ListPaymentsExportFilter & { limit: number; offset: number },
  ): Promise<PaymentRecord[]> {
    const where = exportWhere(filter);
    const base = this.db
      .select({
        payment,
        refInvoiceNumber: paymentExternalRef.xeroInvoiceNumber,
        refOnlineUrl: paymentExternalRef.onlineInvoiceUrl,
        refSyncStatus: paymentExternalRef.syncStatus,
        refLastError: paymentExternalRef.lastError,
      })
      .from(payment)
      .leftJoin(paymentExternalRef, eq(payment.id, paymentExternalRef.paymentId));
    const rows = await (where ? base.where(where) : base)
      .orderBy(desc(payment.createdAt))
      .limit(filter.limit)
      .offset(filter.offset);
    return rows.map((r) =>
      mapRow(r.payment, {
        xeroInvoiceNumber: r.refInvoiceNumber ?? null,
        xeroOnlineInvoiceUrl: r.refOnlineUrl ?? null,
        xeroSyncStatus: r.refSyncStatus ?? null,
        xeroLastError: r.refLastError ?? null,
      }),
    );
  }

  async countForExport(filter: ListPaymentsExportFilter): Promise<number> {
    const where = exportWhere(filter);
    const [row] = await (where
      ? this.db.select({ n: sql<number>`count(*)::int` }).from(payment).where(where)
      : this.db.select({ n: sql<number>`count(*)::int` }).from(payment));
    return row?.n ?? 0;
  }
}
