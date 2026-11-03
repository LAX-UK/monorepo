import type pino from "pino";
import { postInternalCronJob } from "./post-internal-cron-job.js";

/**
 * Asks the API to send the payment reminders that are due. The API decides from each invoice
 * (its due date, whether it is held for our own checks, whether the sale has ended) and takes
 * each step before sending it, so running this as often as we like sends each reminder once.
 */
export async function runPaymentRemindersJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  const result = await postInternalCronJob({
    apiBaseUrl: opts.apiBaseUrl,
    cronSecret: opts.cronSecret,
    path: "payment-reminders",
    log: opts.log,
  });
  if (result.outcome !== "completed") return;
  opts.log.info({ outcome: result.outcome }, "payment reminders completed");
}
