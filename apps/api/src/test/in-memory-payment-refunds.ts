import type {
  IPaymentRefundLedger,
  IPaymentRefundReader,
  IRefundReversalLedger,
  PaymentRefundEntry,
  PaymentRefundTotal,
  RefundReversalTarget,
} from "@auction/persistence/interfaces";

/**
 * The refund record kept in memory, with the same once-per-key rule as the table's unique index,
 * and the reversal ledger with its once-per-refund-and-record rule.
 */
export class InMemoryPaymentRefunds
  implements IPaymentRefundLedger, IPaymentRefundReader, IRefundReversalLedger
{
  readonly entries: PaymentRefundEntry[] = [];
  /** `<kind>:<id>:<stripe refund id>` of each refund taken back from a record. */
  readonly reversals = new Map<string, number>();

  async recordInTransaction(_tx: unknown, entry: PaymentRefundEntry): Promise<boolean> {
    this.calls.push(`record:${entry.paymentId}`);
    const reversal = entry.source === "refund_reversal";
    if (
      !Number.isSafeInteger(entry.amountPence) ||
      (reversal ? entry.amountPence >= 0 : entry.amountPence <= 0)
    ) {
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

  async reversedRefundIdsInTransaction(
    _tx: unknown,
    target: RefundReversalTarget,
  ): Promise<ReadonlySet<string>> {
    const prefix = `${target.kind}:${target.id}:`;
    return new Set(
      [...this.reversals.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length)),
    );
  }

  async recordReversalInTransaction(
    _tx: unknown,
    target: RefundReversalTarget,
    reversal: { stripeRefundId: string; amountPence: number },
  ): Promise<boolean> {
    const key = `${target.kind}:${target.id}:${reversal.stripeRefundId}`;
    if (this.reversals.has(key)) return false;
    this.reversals.set(key, reversal.amountPence);
    return true;
  }
}
