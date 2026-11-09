import type { Database } from "@auction/db";
import { payment, paymentRefund } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import type {
  IPaymentRefundLedger,
  IPaymentRefundReader,
  PaymentRefundEntry,
  PaymentRefundTotal,
} from "../interfaces/payment-refund.repository.js";

const GBP = "GBP";

export class DrizzlePaymentRefundRepository implements IPaymentRefundReader, IPaymentRefundLedger {
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
    if (!Number.isSafeInteger(entry.amountPence) || entry.amountPence <= 0) {
      throw new RangeError(
        `A refund is a whole number of pence above zero, got ${entry.amountPence}`,
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
