import type pino from "pino";
import { postInternalCronJob } from "./post-internal-cron-job.js";

/**
 * Asks the API to catch up on consignment threads: tell the account about staff replies whose
 * delivery job was lost, and return covers that passed their end date to the specialist. The API
 * does each once, so running this again, or twice at once, changes nothing twice.
 */
export async function runConsignmentThreadSweepJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  const result = await postInternalCronJob({
    apiBaseUrl: opts.apiBaseUrl,
    cronSecret: opts.cronSecret,
    path: "consignment-thread-sweep",
    log: opts.log,
  });
  if (result.outcome !== "completed") return;
  opts.log.info({ outcome: result.outcome }, "consignment thread sweep completed");
}
