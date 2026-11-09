import type {
  IPaymentRefundLedger,
  IPaymentRefundReader,
  PaymentRefundEntry,
  PaymentRefundTotal,
} from "@auction/persistence/interfaces";

/** The refund record kept in memory, with the same once-per-key rule as the table's unique index. */
export class InMemoryPaymentRefunds implements IPaymentRefundLedger, IPaymentRefundReader {
  readonly entries: PaymentRefundEntry[] = [];

  async recordInTransaction(_tx: unknown, entry: PaymentRefundEntry): Promise<boolean> {
    this.calls.push(`record:${entry.paymentId}`);
    if (!Number.isSafeInteger(entry.amountPence) || entry.amountPence <= 0) {
      throw new RangeError(`bad refund amount ${entry.amountPence}`);
    }
    if (this.entries.some((e) => e.idempotencyKey === entry.idempotencyKey)) return false;
    this.entries.push({ ...entry, currency: entry.currency.toUpperCase() });
    return true;
  }

  /** Calls made to lock a payment, in order, so a test can check the lock comes before the sum. */
  readonly calls: string[] = [];

  async lockPaymentInTransaction(_tx: unknown, paymentId: string): Promise<boolean> {
    this.calls.push(`lock:${paymentId}`);
    return true;
  }

  sumRefundedPenceInTransaction(_tx: unknown, paymentId: string): Promise<PaymentRefundTotal> {
    this.calls.push(`sum:${paymentId}`);
    return this.sumRefundedPence(paymentId);
  }

  async sumRefundedPence(paymentId: string): Promise<PaymentRefundTotal> {
    const own = this.entries.filter((e) => e.paymentId === paymentId);
    return {
      pence: own.filter((e) => e.currency === "GBP").reduce((sum, e) => sum + e.amountPence, 0),
      otherCurrencies: [...new Set(own.map((e) => e.currency).filter((c) => c !== "GBP"))].sort(),
    };
  }
}
