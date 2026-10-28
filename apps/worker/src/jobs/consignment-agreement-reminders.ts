import type pino from "pino";
import { postInternalCronJob } from "./post-internal-cron-job.js";

/**
 * Asks the API to remind sellers whose consignment agreement is still waiting. The API decides
 * who is due (day 3, then day 7, never after acceptance) and marks each reminder before sending,
 * so running this as often as we like sends each one once.
 */
export async function runConsignmentAgreementRemindersJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  const result = await postInternalCronJob({
    apiBaseUrl: opts.apiBaseUrl,
    cronSecret: opts.cronSecret,
    path: "consignment-agreement-reminders",
    log: opts.log,
  });
  if (result.outcome !== "completed") return;
  opts.log.info({ outcome: result.outcome }, "consignment agreement reminders completed");
}
