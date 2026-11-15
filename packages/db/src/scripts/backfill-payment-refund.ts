/**
 * Copies refunds the payout ledger knows of into payment_refund, for every payment, beside live
 * traffic: payments are locked in id order a batch at a time and topped up one by one with the
 * per-payment form of payment_refund_backfill_from_payout_lines (see ../payment-refund-backfill.ts).
 * Use this rather than the function's no-argument form on a live database.
 *
 * Usage from packages/db:
 *   DATABASE_URL=... pnpm db:backfill-payment-refund [--batch-size=200]
 *
 * Safe to repeat: a payment whose record already covers its refund lines gets nothing.
 */
import pg from "pg";
import {
  DEFAULT_PAYMENT_REFUND_BACKFILL_BATCH_SIZE,
  backfillPaymentRefundsInIdOrder,
} from "../payment-refund-backfill.js";
import { buildPgConnectionConfig } from "../ssl.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL.");
  process.exit(1);
}
const flag = process.argv.find((arg) => arg.startsWith("--batch-size="));
const batchSize = flag
  ? Number(flag.slice("--batch-size=".length))
  : DEFAULT_PAYMENT_REFUND_BACKFILL_BATCH_SIZE;

const client = new pg.Client(buildPgConnectionConfig(url));
await client.connect();
try {
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
