/**
 * Copies refunds the payout ledger knows of into payment_refund, for every payment, beside live
 * traffic: payments are locked in id order a batch at a time and topped up one by one with the
 * per-payment form of payment_refund_backfill_from_payout_lines (see ../payment-refund-backfill.ts).
 * Use this rather than the function's no-argument form on a live database.
 *
 * Usage from packages/db (a dry run is the default: it reads, takes no locks and writes nothing):
 *   DATABASE_URL=... pnpm db:backfill-payment-refund
 *   DATABASE_URL=... pnpm db:backfill-payment-refund --apply [--batch-size=200]
 *
 * The dry run lists, per payment whose refund payout lines differ from its payment_refund rows,
 * line_pence - recorded_pence; only a positive difference is topped up by --apply. Before writing,
 * --apply prints the target host and database name (never the credentials).
 *
 * Safe to repeat: a payment whose record already covers its refund lines gets nothing.
 */
import pg from "pg";
import {
  DEFAULT_PAYMENT_REFUND_BACKFILL_BATCH_SIZE,
  backfillPaymentRefundsInIdOrder,
  reportPaymentRefundGaps,
} from "../payment-refund-backfill.js";
import { buildPgConnectionConfig } from "../ssl.js";

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
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL.");
  const apply = process.argv.includes("--apply");
  const flag = process.argv.find((arg) => arg.startsWith("--batch-size="));
  const batchSize = flag
    ? Number(flag.slice("--batch-size=".length))
    : DEFAULT_PAYMENT_REFUND_BACKFILL_BATCH_SIZE;

  const client = new pg.Client(buildPgConnectionConfig(url));
  await client.connect();
  try {
    const target = await describeTarget(client);
    if (!apply) {
      console.log(`Dry run against ${target}: reading only, no locks taken, nothing written.`);
      const gaps = await reportPaymentRefundGaps(client);
      let wouldAddPayments = 0;
      let wouldAddPence = 0;
      for (const gap of gaps) {
        console.log(
          `${gap.paymentId}: line_pence ${gap.linePence} - recorded_pence ${gap.recordedPence} = ${gap.differencePence}${gap.differencePence > 0 ? " (would top up)" : " (left as is)"}`,
        );
        if (gap.differencePence > 0) {
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
