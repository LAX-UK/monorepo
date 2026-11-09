import type { Database } from "@auction/db";
import { paymentRefund } from "@auction/db/schema";
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
