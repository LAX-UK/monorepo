import type pino from "pino";
import { postInternalCronJob } from "./post-internal-cron-job.js";

/**
 * Asks the API to send the watched-lot reminders that are due. The API decides what is due from
 * each lot's current times and claims each reminder before sending, so running this as often as
 * we like sends each one once.
 */
export async function runWatchedLotRemindersJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  const result = await postInternalCronJob({
    apiBaseUrl: opts.apiBaseUrl,
    cronSecret: opts.cronSecret,
    path: "watched-lot-reminders",
    log: opts.log,
  });
  if (result.outcome !== "completed") return;
  opts.log.info({ outcome: result.outcome }, "watched lot reminders completed");
}
