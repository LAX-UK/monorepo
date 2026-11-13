import type { Database } from "@auction/db";
import { payment, paymentRefund, stripeRefundReversal } from "@auction/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type {
  IPaymentRefundLedger,
  IPaymentRefundReader,
  IRefundReversalLedger,
  PaymentRefundEntry,
  PaymentRefundTotal,
  RefundReversalTarget,
} from "../interfaces/payment-refund.repository.js";

const GBP = "GBP";

export class DrizzlePaymentRefundRepository
  implements IPaymentRefundReader, IPaymentRefundLedger, IRefundReversalLedger
{
  constructor(private readonly db: Database) {}

  sumRefundedPence(paymentId: string): Promise<PaymentRefundTotal> {
    return this.sum(this.db, paymentId);
  }

  async lockPaymentInTransaction(tx: Database, paymentId: string): Promise<boolean> {
    const rows = await tx
      .select({ id: payment.id })
      .from(payment)
      .where(eq(payment.id, paymentId))
      .for("update");
    if (rows.length === 0) return false;
    // A refund the previous release handled has a payout line and no row here until the backfill
    // is run again. Copied now, under the lock, it is part of the sum that follows.
    await tx.execute(sql`SELECT payment_refund_backfill_from_payout_lines(${paymentId}::uuid)`);
    return true;
  }

  sumRefundedPenceInTransaction(tx: Database, paymentId: string): Promise<PaymentRefundTotal> {
    return this.sum(tx, paymentId);
  }

  async recordInTransaction(tx: Database, entry: PaymentRefundEntry): Promise<boolean> {
    const reversal = entry.source === "refund_reversal";
    if (
      !Number.isSafeInteger(entry.amountPence) ||
      (reversal ? entry.amountPence >= 0 : entry.amountPence <= 0)
    ) {
      throw new RangeError(
        reversal
          ? `A refund reversal is a whole number of pence below zero, got ${entry.amountPence}`
          : `A refund is a whole number of pence above zero, got ${entry.amountPence}`,
      );
    }
    const rows = await tx
      .insert(paymentRefund)
      .values({
        paymentId: entry.paymentId,
        idempotencyKey: entry.idempotencyKey,
        stripeRefundId: entry.stripeRefundId ?? null,
        amountPence: entry.amountPence,
        currency: entry.currency.toUpperCase(),
        source: entry.source,
      })
      .onConflictDoNothing({ target: paymentRefund.idempotencyKey })
      .returning({ id: paymentRefund.id });
    return rows.length > 0;
  }

  async reversedRefundIdsInTransaction(
    tx: Database,
    target: RefundReversalTarget,
  ): Promise<ReadonlySet<string>> {
    const rows = await tx
      .select({ id: stripeRefundReversal.stripeRefundId })
      .from(stripeRefundReversal)
      .where(
        and(
          eq(stripeRefundReversal.target, target.kind),
          eq(stripeRefundReversal.targetId, target.id),
        ),
      );
    return new Set(rows.map((r) => r.id));
  }

  async recordReversalInTransaction(
    tx: Database,
    target: RefundReversalTarget,
    reversal: { stripeRefundId: string; amountPence: number },
  ): Promise<boolean> {
    if (!Number.isSafeInteger(reversal.amountPence) || reversal.amountPence <= 0) {
      throw new RangeError(
        `A refund reversal takes back a whole number of pence above zero, got ${reversal.amountPence}`,
      );
    }
    const rows = await tx
      .insert(stripeRefundReversal)
      .values({
        stripeRefundId: reversal.stripeRefundId,
        target: target.kind,
        targetId: target.id,
        amountPence: reversal.amountPence,
      })
      .onConflictDoNothing()
      .returning({ id: stripeRefundReversal.stripeRefundId });
    return rows.length > 0;
  }

  private async sum(executor: Database, paymentId: string): Promise<PaymentRefundTotal> {
    const rows = await executor
      .select({
        currency: paymentRefund.currency,
        pence: sql<string>`COALESCE(SUM(${paymentRefund.amountPence}), 0)::text`,
      })
      .from(paymentRefund)
      .where(eq(paymentRefund.paymentId, paymentId))
      .groupBy(paymentRefund.currency);
    let pence = 0;
    const otherCurrencies: string[] = [];
    for (const row of rows) {
      if (row.currency === GBP) pence = Number(row.pence);
      else otherCurrencies.push(row.currency);
    }
    return { pence, otherCurrencies: otherCurrencies.sort() };
  }
}
