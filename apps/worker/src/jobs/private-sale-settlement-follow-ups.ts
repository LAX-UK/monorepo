import type pino from "pino";
import { postInternalCronJob } from "./post-internal-cron-job.js";

/**
 * Asks the API to check every settled private sale: is its artwork recorded sold in the register?
 * The staff item is derived on every read, so the lists and the bell never wait for this. The
 * check raises each deal's alert once, so running it again, or twice at once, tells nobody twice.
 */
export async function runPrivateSaleSettlementFollowUpsJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  const result = await postInternalCronJob({
    apiBaseUrl: opts.apiBaseUrl,
    cronSecret: opts.cronSecret,
    path: "private-sale-settlement-follow-ups",
    log: opts.log,
  });
  if (result.outcome !== "completed") return;
  opts.log.info({ outcome: result.outcome }, "private sale settlement follow-ups completed");
}
