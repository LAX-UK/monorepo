/**
 * Copies refunds the payout ledger knows of into payment_refund, for every payment, beside live
 * traffic: payments are locked in id order a batch at a time and topped up one by one with the
 * per-payment form of payment_refund_backfill_from_payout_lines (see ../payment-refund-backfill.ts).
 * Use this rather than the function's no-argument form on a live database.
 *
 * Usage from the repository root (a dry run is the default: it reads, takes no locks and writes
 * nothing). The `--` before the flags is optional; pnpm passes it through and it is skipped:
 *   DATABASE_URL=... pnpm --filter @auction/db db:backfill-payment-refund
 *   DATABASE_URL=... pnpm --filter @auction/db db:backfill-payment-refund -- --apply
 *     [--batch-size=200] [--lock-timeout=5s] [--resume-after=<payment id>]
 *
 * Every flag is validated before connecting (bad input exits non-zero, nothing is opened).
 * The dry run covers every payment (or those after --resume-after when given) and ignores
 * --batch-size and --lock-timeout; it lists, per payment whose refund payout lines differ from its payment_refund rows,
 * line_pence - recorded_pence; only a positive difference is topped up by --apply. Before writing,
 * --apply prints the target host and database name (never the credentials).
 *
 * Each batch transaction sets lock_timeout (--lock-timeout, default 5s; accepts 500ms, 5s, 1m or a
 * bare number of milliseconds; 0 waits indefinitely). If a live transaction holds a payment lock
 * longer, the batch is rolled back with nothing written and this exits non-zero, printing the batch
 * and the resume cursor. Run it again (it is idempotent) or pass --resume-after=<cursor> to skip the
 * batches already committed.
 *
 * Safe to repeat: a payment whose record already covers its refund lines gets nothing.
 */
import pg from "pg";
import {
  DEFAULT_PAYMENT_REFUND_BACKFILL_BATCH_SIZE,
  DEFAULT_PAYMENT_REFUND_BACKFILL_LOCK_TIMEOUT_MS,
  PaymentRefundBackfillError,
  backfillPaymentRefundsInIdOrder,
  reportPaymentRefundGaps,
} from "../payment-refund-backfill.js";
import { buildPgConnectionConfig } from "../ssl.js";
import { parseBackfillArgs, resumeCommand } from "./backfill-payment-refund-args.js";

/** Host and database name of the target, from the server itself; no user or password. */
async function describeTarget(client: pg.Client): Promise<string> {
  const { rows } = await client.query<{ host: string | null; database: string }>(
    "SELECT host(inet_server_addr()) AS host, current_database() AS database",
  );
  const host = client.host || rows[0]?.host || "local socket";
  const port = client.port ? `:${client.port}` : "";
  return `host ${host}${port}, database ${rows[0]?.database ?? client.database}`;
}

async function main(): Promise<void> {
  const { apply, batchSize, lockTimeoutMs, resumeAfter } = parseBackfillArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL.");
  resumeBatchSize = batchSize;
  resumeLockTimeoutMs = lockTimeoutMs;

  const client = new pg.Client(buildPgConnectionConfig(url));
  await client.connect();
  try {
    const target = await describeTarget(client);
    if (!apply) {
      console.log(
        `Dry run against ${target}: reading only, no locks taken, nothing written. It covers every payment${resumeAfter ? ` after ${resumeAfter} (--resume-after)` : ""}; --batch-size and --lock-timeout only affect --apply.`,
      );
      const gaps = await reportPaymentRefundGaps(client, { resumeAfter });
      let wouldAddPayments = 0;
      let wouldAddPence = 0;
      for (const gap of gaps) {
        const verdict = gap.wouldTopUp
          ? " (would top up)"
          : gap.differencePence > 0 && gap.topupKeyExists
            ? " (top-up row with this key exists already, --apply adds nothing)"
            : " (left as is)";
        console.log(
          `${gap.paymentId}: line_pence ${gap.linePence} - recorded_pence ${gap.recordedPence} = ${gap.differencePence}${verdict}`,
        );
        if (gap.wouldTopUp) {
          wouldAddPayments += 1;
          wouldAddPence += gap.differencePence;
        }
      }
      console.log(
        `${gaps.length} payment(s) whose record differs from their refund lines; ${wouldAddPayments} would get a payout_topup row, ${wouldAddPence} pence in all.`,
      );
      console.log("Dry run only. Re-run with --apply to write.");
      return;
    }
    console.log(`Applying the payment_refund backfill to ${target}.`);
    const result = await backfillPaymentRefundsInIdOrder(client, {
      batchSize,
      lockTimeoutMs,
      resumeAfter,
      onBatch: ({ paymentIds, added }) =>
        console.log(
          `${paymentIds.length} payment(s) up to ${paymentIds.at(-1)}: ${added} row(s) added`,
        ),
    });
    console.log(
      `${result.payments} payment(s) with refund lines in ${result.batches} batch(es); ${result.added} payment_refund row(s) added.`,
    );
  } finally {
    await client.end();
  }
}

let resumeBatchSize = DEFAULT_PAYMENT_REFUND_BACKFILL_BATCH_SIZE;
let resumeLockTimeoutMs = DEFAULT_PAYMENT_REFUND_BACKFILL_LOCK_TIMEOUT_MS;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof PaymentRefundBackfillError) {
    console.error(
      `Resume: DATABASE_URL=... ${resumeCommand(
        { batchSize: resumeBatchSize, lockTimeoutMs: resumeLockTimeoutMs },
        error.resumeAfter,
      )}`,
    );
  }
  process.exit(1);
});
