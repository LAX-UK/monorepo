import type pino from "pino";
import { postInternalCronJob } from "./post-internal-cron-job.js";

/**
 * Asks the API to record staff roles whose end date has passed. The API records each end once,
 * writes the audit event, refreshes the role the profile shows and notifies the people involved,
 * so running this again, or twice at once, sends nothing twice.
 */
export async function runStaffRoleExpiryJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  const result = await postInternalCronJob({
    apiBaseUrl: opts.apiBaseUrl,
    cronSecret: opts.cronSecret,
    path: "staff-role-expiry",
    log: opts.log,
  });
  if (result.outcome !== "completed") return;
  opts.log.info({ outcome: result.outcome }, "staff role expiry completed");
}
