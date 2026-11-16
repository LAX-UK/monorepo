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
 * locked with `ORDER BY id ... FOR NO KEY UPDATE`, each is topped up with the per-payment form of the
 * function (unchanged, the same call the live paths make under their lock), and the batch commits
 * before the next one starts after the last id. The payout run locks payments in id order too, and a
 * refund locks one payment, so no cycle of waits can form; a payment a live refund holds is simply
 * waited for, then measured against what that refund committed.
 *
 * The lock is `FOR NO KEY UPDATE`, not `FOR UPDATE`: it still conflicts with the live paths'
 * `FOR UPDATE` (and with any UPDATE of a payment), so the run serialises against them as above, but
 * it does not block the `FOR KEY SHARE` lock a foreign key takes when a `dispute_allocation`,
 * `payout_line` or `payment_refund` row naming the payment is inserted. Those inserts can name
 * several payments out of id order (a dispute's allocation lines, before it locks the payments in
 * order), so a key-share wait would let them form a cycle with this run.
 *
 * The run resumes after the last id it locked and does not look back. A payment below that cursor
 * that gains its first refund line while the run is going is not visited by it; that is deliberate,
 * not a gap to close with a loop: every live path that adds a refund line or reads the refund sum
 * tops the payment up with the per-payment function under its lock first, and a re-run picks the
 * payment up too.
 *
 * Idempotent: the per-payment function adds a row only where the refund lines exceed the recorded
 * refunds, under a key that names the line total, so a re-run (or a run beside another) adds nothing.
 *
 * Each batch transaction sets `lock_timeout` (5s by default), so a live refund that holds a payment
 * lock for long cannot keep the run waiting indefinitely. On a lock timeout (SQLSTATE 55P03) the
 * batch is rolled back whole, nothing of it is written, and the run stops with a
 * {@link PaymentRefundBackfillLockTimeoutError} that names the batch and the cursor to resume from.
 * Batches before it are committed and stay; re-running from the start is also safe (idempotent).
 */

/** One connection: the run opens and commits its own transactions on it. */
export type PaymentRefundBackfillConnection = {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
};

export type PaymentRefundBackfillOptions = {
  /** Payments locked and topped up per transaction. */
  batchSize?: number;
  /** `lock_timeout` set inside each batch transaction, in milliseconds; 0 waits indefinitely. */
  lockTimeoutMs?: number;
  /** Payment id to resume after (the cursor a lock timeout reported); omit to start from the first. */
  resumeAfter?: string | null;
  /** Called after each batch commits. */
  onBatch?: (batch: { paymentIds: readonly string[]; added: number }) => void;
};

export type PaymentRefundBackfillResult = {
  batches: number;
  payments: number;
  added: number;
};

export const DEFAULT_PAYMENT_REFUND_BACKFILL_BATCH_SIZE = 200;
export const DEFAULT_PAYMENT_REFUND_BACKFILL_LOCK_TIMEOUT_MS = 5000;

/** Set per batch transaction; `set_config(..., true)` is SET LOCAL with a bindable value. */
export const SET_BATCH_LOCK_TIMEOUT_SQL = "SELECT set_config('lock_timeout', $1, true)";

const LOCK_NOT_AVAILABLE = "55P03";

/** What a failed run leaves behind: where it stopped and how to continue. */
function resumeNote(resumeAfter: string | null, completed: PaymentRefundBackfillResult): string {
  const done = `${completed.batches} earlier batch(es) (${completed.payments} payment(s), ${completed.added} row(s) added) are committed.`;
  const resume =
    resumeAfter === null
      ? "Resume cursor: none, nothing was committed; re-run from the start."
      : `Resume cursor: ${resumeAfter}; re-run with --resume-after=${resumeAfter} (or from the start: it is idempotent).`;
  return `${done} ${resume}`;
}

/**
 * A batch failed and was rolled back with nothing of it written. Whatever the cause, the run
 * reports where to continue: the last payment id the committed batches reached.
 */
export class PaymentRefundBackfillError extends Error {
  constructor(
    message: string,
    /** 1-based number of the batch that failed, counting from this run's start. */
    readonly batch: number,
    /** Last payment id of the committed batches; pass it as `resumeAfter` / --resume-after. Null: none yet. */
    readonly resumeAfter: string | null,
    /** What the committed batches before it did. */
    readonly completed: PaymentRefundBackfillResult,
    options?: { cause?: unknown },
  ) {
    super(`${message} ${resumeNote(resumeAfter, completed)}`, options);
    this.name = "PaymentRefundBackfillError";
  }
}

/** A batch waited longer than the lock timeout for a payment lock; the batch was rolled back. */
export class PaymentRefundBackfillLockTimeoutError extends PaymentRefundBackfillError {
  constructor(
    batch: number,
    resumeAfter: string | null,
    completed: PaymentRefundBackfillResult,
    readonly lockTimeoutMs: number,
  ) {
    super(
      `Lock timeout after ${lockTimeoutMs} ms in batch ${batch}: a payment lock is held elsewhere. The batch was rolled back and nothing of it was written;`,
      batch,
      resumeAfter,
      completed,
    );
    this.name = "PaymentRefundBackfillLockTimeoutError";
  }
}

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
FOR NO KEY UPDATE OF p`;

/**
 * What a run would add, read without locks: per payment with refund payout lines whose record differs
 * from them, the refund lines' total (line_pence), the payment_refund total (recorded_pence) and the
 * difference, computed as payment_refund_backfill_from_payout_lines (0378) computes it. Only a
 * positive difference is topped up.
 */
export const REPORT_REFUND_GAPS_SQL = `SELECT t."payment_id", t."line_pence", t."recorded_pence",
  t."line_pence" - t."recorded_pence" AS "difference_pence",
  EXISTS (
    SELECT 1 FROM "payment_refund" k
    WHERE k."idempotency_key" = 'payout_ledger_topup:' || t."payment_id" || ':' || t."line_pence"
  ) AS "topup_key_exists"
FROM (
  SELECT
    l."payment_id",
    SUM(COALESCE(l."buyer_refund_pence", round(-l."amount" * 100)))::bigint AS "line_pence",
    COALESCE((
      SELECT SUM(r."amount_pence")
      FROM "payment_refund" r
      WHERE r."payment_id" = l."payment_id" AND r."currency" = 'GBP'
    ), 0)::bigint AS "recorded_pence"
  FROM "payout_line" l
  WHERE l."kind" = 'refund' AND l."payment_id" IS NOT NULL
  GROUP BY l."payment_id"
) t
WHERE t."line_pence" <> t."recorded_pence"
  AND ($1::uuid IS NULL OR t."payment_id" > $1::uuid)
ORDER BY t."payment_id"`;

export type PaymentRefundGap = {
  paymentId: string;
  linePence: number;
  recordedPence: number;
  differencePence: number;
  /** A row under the top-up key exists already, so --apply writes nothing for this payment. */
  topupKeyExists: boolean;
  /** What --apply would insert for this payment: a positive difference with no row under the key. */
  wouldTopUp: boolean;
};

/** The dry run: what {@link backfillPaymentRefundsInIdOrder} would top up, read without locks. */
export async function reportPaymentRefundGaps(
  connection: PaymentRefundBackfillConnection,
  options: { resumeAfter?: string | null } = {},
): Promise<PaymentRefundGap[]> {
  const { rows } = await connection.query(REPORT_REFUND_GAPS_SQL, [options.resumeAfter ?? null]);
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const differencePence = Number(r.difference_pence);
    const topupKeyExists = r.topup_key_exists === true;
    return {
      paymentId: String(r.payment_id),
      linePence: Number(r.line_pence),
      recordedPence: Number(r.recorded_pence),
      differencePence,
      topupKeyExists,
      wouldTopUp: differencePence > 0 && !topupKeyExists,
    };
  });
}

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
  const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_PAYMENT_REFUND_BACKFILL_LOCK_TIMEOUT_MS;
  if (!Number.isSafeInteger(lockTimeoutMs) || lockTimeoutMs < 0) {
    throw new RangeError(
      `The lock timeout is whole milliseconds, zero or more, got ${lockTimeoutMs}`,
    );
  }
  const result: PaymentRefundBackfillResult = { batches: 0, payments: 0, added: 0 };
  let after: string | null = options.resumeAfter ?? null;
  for (;;) {
    await connection.query("BEGIN");
    let paymentIds: string[];
    let added = 0;
    try {
      await connection.query(SET_BATCH_LOCK_TIMEOUT_SQL, [`${lockTimeoutMs}ms`]);
      const locked = await connection.query(LOCK_NEXT_REFUND_PAYMENTS_SQL, [after, batchSize]);
      paymentIds = locked.rows.map(idOf);
      for (const paymentId of paymentIds) {
        const { rows } = await connection.query(BACKFILL_ONE_PAYMENT_SQL, [paymentId]);
        added += Number((rows[0] as { added?: unknown } | undefined)?.added ?? 0);
      }
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: unknown } | null)?.code === LOCK_NOT_AVAILABLE) {
        throw new PaymentRefundBackfillLockTimeoutError(
          result.batches + 1,
          after,
          { ...result },
          lockTimeoutMs,
        );
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new PaymentRefundBackfillError(
        `Batch ${result.batches + 1} failed: ${reason}. It was rolled back and nothing of it was written;`,
        result.batches + 1,
        after,
        { ...result },
        { cause: error },
      );
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
