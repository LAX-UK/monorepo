import type pino from "pino";
import { DEFAULT_GATEWAY_RETRY, postInternalCronJob } from "./post-internal-cron-job.js";

/**
 * Asks the API to re-read the Stripe refunds that were pending or requiring action and settle
 * each one that is now final. It is what counts a refund that finished later when the payments
 * endpoint receives no `charge.refund.updated`. Each refund is settled from Stripe's own list
 * under the payment's lock and claimed once per refund and status, so a repeat, an overlap with
 * the first request, or the webhook doing the same work records nothing twice.
 */
export async function runStripeRefundReconcileJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  const result = await postInternalCronJob({
    apiBaseUrl: opts.apiBaseUrl,
    cronSecret: opts.cronSecret,
    path: "stripe-refund-reconcile",
    log: opts.log,
    gatewayRetry: DEFAULT_GATEWAY_RETRY,
  });
  if (result.outcome !== "completed") return;
  opts.log.info({ outcome: result.outcome }, "stripe refund reconcile completed");
}
