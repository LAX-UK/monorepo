/**
 * The global run of the payment_refund backfill, safe beside live refunds and captures.
 *
 * `payment_refund_backfill_from_payout_lines()` with no argument (migration 0344, replaced in 0378)
 * tops up every payment in one statement and takes no payment lock: it writes rows for payments in
 * whatever order the plan produces, while the live refund and payout paths hold a payment's lock
 * (`SELECT ... FOR UPDATE`) and call the same function for that one payment. A global statement
 * that reaches a payment a live refund has locked waits for it while holding what it already wrote
 * for other payments, and a live transaction that then wants one of those deadlocks against it.
 *
 * This run takes the locks itself, in one order: a batch of payments with refund payout lines is
 * locked with `ORDER BY id ... FOR UPDATE`, each is topped up with the per-payment form of the
 * function (unchanged, the same call the live paths make under their lock), and the batch commits
 * before the next one starts after the last id. The payout run locks payments in id order too, and a
 * refund locks one payment, so no cycle of waits can form; a payment a live refund holds is simply
 * waited for, then measured against what that refund committed.
 *
 * Idempotent: the per-payment function adds a row only where the refund lines exceed the recorded
 * refunds, under a key that names the line total, so a re-run (or a run beside another) adds nothing.
 */

/** One connection: the run opens and commits its own transactions on it. */
export type PaymentRefundBackfillConnection = {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
};

export type PaymentRefundBackfillOptions = {
  /** Payments locked and topped up per transaction. */
  batchSize?: number;
  /** Called after each batch commits. */
  onBatch?: (batch: { paymentIds: readonly string[]; added: number }) => void;
};

export type PaymentRefundBackfillResult = {
  batches: number;
  payments: number;
  added: number;
};

export const DEFAULT_PAYMENT_REFUND_BACKFILL_BATCH_SIZE = 200;

/**
 * The next batch of payments that have a refund payout line, after the given id, locked in id order.
 * The lock is taken as rows leave the sort, so it is always taken in ascending id order.
 */
export const LOCK_NEXT_REFUND_PAYMENTS_SQL = `SELECT p."id"
FROM "payment" p
WHERE ($1::uuid IS NULL OR p."id" > $1::uuid)
  AND EXISTS (
    SELECT 1 FROM "payout_line" l
    WHERE l."payment_id" = p."id" AND l."kind" = 'refund'
  )
ORDER BY p."id"
LIMIT $2
FOR UPDATE OF p`;

/** The per-payment form, as the live refund and payout paths call it under the payment's lock. */
export const BACKFILL_ONE_PAYMENT_SQL =
  "SELECT payment_refund_backfill_from_payout_lines($1::uuid) AS added";

function idOf(row: unknown): string {
  const id = (row as { id?: unknown }).id;
  if (typeof id !== "string") throw new Error("Expected a payment id from the lock query");
  return id;
}

export async function backfillPaymentRefundsInIdOrder(
  connection: PaymentRefundBackfillConnection,
  options: PaymentRefundBackfillOptions = {},
): Promise<PaymentRefundBackfillResult> {
  const batchSize = options.batchSize ?? DEFAULT_PAYMENT_REFUND_BACKFILL_BATCH_SIZE;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new RangeError(`The batch size is a whole number above zero, got ${batchSize}`);
  }
  const result: PaymentRefundBackfillResult = { batches: 0, payments: 0, added: 0 };
  let after: string | null = null;
  for (;;) {
    await connection.query("BEGIN");
    let paymentIds: string[];
    let added = 0;
    try {
      const locked = await connection.query(LOCK_NEXT_REFUND_PAYMENTS_SQL, [after, batchSize]);
      paymentIds = locked.rows.map(idOf);
      for (const paymentId of paymentIds) {
        const { rows } = await connection.query(BACKFILL_ONE_PAYMENT_SQL, [paymentId]);
        added += Number((rows[0] as { added?: unknown } | undefined)?.added ?? 0);
      }
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
    if (paymentIds.length === 0) return result;
    result.batches += 1;
    result.payments += paymentIds.length;
    result.added += added;
    options.onBatch?.({ paymentIds, added });
    after = paymentIds[paymentIds.length - 1] ?? after;
    if (paymentIds.length < batchSize) return result;
  }
}
