import type { Database } from "@auction/db";
import { payment, paymentExternalRef, paymentRefundReconcile } from "@auction/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  IPaymentRefundReconcileRepository,
  PaymentRefundReconcilePayload,
  PaymentRefundReconcileRow,
} from "../interfaces/payment-refund-reconcile.repository.js";

export class DrizzlePaymentRefundReconcileRepository implements IPaymentRefundReconcileRepository {
  constructor(private readonly db: Database) {}

  async enqueue(input: {
    paymentId: string;
    stripeRefundId: string | null;
    adminUserId: string | null;
    payload: PaymentRefundReconcilePayload;
  }): Promise<void> {
    const now = new Date();
    await this.db
      .insert(paymentRefundReconcile)
      .values({
        paymentId: input.paymentId,
        stripeRefundId: input.stripeRefundId,
        adminUserId: input.adminUserId,
        payload: input.payload,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: paymentRefundReconcile.paymentId,
        set: {
          stripeRefundId: input.stripeRefundId,
          adminUserId: input.adminUserId,
          payload: input.payload,
          lastError: null,
          updatedAt: now,
        },
      });
  }

  async listPending(limit: number): Promise<PaymentRefundReconcileRow[]> {
    const rows = await this.db
      .select()
      .from(paymentRefundReconcile)
      .where(isNull(paymentRefundReconcile.reconciledAt))
      .orderBy(paymentRefundReconcile.createdAt)
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      paymentId: row.paymentId,
      stripeRefundId: row.stripeRefundId,
      adminUserId: row.adminUserId,
      payload: row.payload as PaymentRefundReconcilePayload,
      attempts: row.attempts,
      lastError: row.lastError,
      reconciledAt: row.reconciledAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async markReconciled(paymentId: string): Promise<void> {
    await this.db
      .update(paymentRefundReconcile)
      .set({ reconciledAt: new Date(), updatedAt: new Date(), lastError: null })
      .where(eq(paymentRefundReconcile.paymentId, paymentId));
  }

  async markFailed(paymentId: string, error: string, attempts: number): Promise<void> {
    await this.db
      .update(paymentRefundReconcile)
      .set({
        attempts,
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(paymentRefundReconcile.paymentId, paymentId));
  }
}

export type PendingStripeCaptureSyncRow = {
  paymentId: string;
  amount: string;
};

export async function listPendingStripeCaptureSync(
  db: Database,
  limit: number,
): Promise<PendingStripeCaptureSyncRow[]> {
  const rows = await db
    .select({
      paymentId: paymentExternalRef.paymentId,
      amount: payment.amount,
    })
    .from(paymentExternalRef)
    .innerJoin(payment, eq(payment.id, paymentExternalRef.paymentId))
    .where(
      and(
        sql`${paymentExternalRef.xeroInvoiceId} IS NOT NULL`,
        isNull(paymentExternalRef.xeroPaymentId),
        eq(payment.status, "captured"),
      ),
    )
    .orderBy(paymentExternalRef.updatedAt)
    .limit(limit);
  return rows.map((r) => ({ paymentId: r.paymentId, amount: String(r.amount) }));
}

export type MissingXeroInvoiceRow = {
  paymentId: string;
  lotId: string;
  buyerId: string;
  amount: string;
};

/**
 * Settleable payments (pending / authorized / captured) that have no Xero ACCREC invoice yet —
 * either no `payment_external_ref` row at all (Xero was disconnected when checkout ran, so the
 * provider returned before inserting a pending row) or a row without an `xeroInvoiceId`.
 *
 * Payment-driven LEFT JOIN (not external-ref-driven) so payments created while Xero was fully
 * down are still picked up. Drained by the `retry-xero-invoice-creation` cron.
 */
export async function listPaymentsMissingXeroInvoice(
  db: Database,
  limit: number,
): Promise<MissingXeroInvoiceRow[]> {
  const rows = await db
    .select({
      paymentId: payment.id,
      lotId: payment.lotId,
      buyerId: payment.buyerId,
      amount: payment.amount,
    })
    .from(payment)
    .leftJoin(paymentExternalRef, eq(paymentExternalRef.paymentId, payment.id))
    .where(
      and(
        inArray(payment.status, ["pending", "authorized", "captured"]),
        isNull(paymentExternalRef.xeroInvoiceId),
      ),
    )
    .orderBy(payment.createdAt)
    .limit(limit);
  return rows.map((r) => ({
    paymentId: r.paymentId,
    lotId: r.lotId,
    buyerId: r.buyerId,
    amount: String(r.amount),
  }));
}
