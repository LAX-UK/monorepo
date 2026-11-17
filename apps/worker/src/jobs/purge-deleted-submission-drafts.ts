import type pino from "pino";
import { DEFAULT_GATEWAY_RETRY, postInternalCronJob } from "./post-internal-cron-job.js";

/**
 * Asks the API to remove drafts their clients deleted more than 30 days ago, with their photos
 * (GAP-53). The API picks what is due and each run removes only that, so running it again, or
 * twice at once, changes nothing more.
 */
export async function runPurgeDeletedSubmissionDraftsJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  const result = await postInternalCronJob({
    apiBaseUrl: opts.apiBaseUrl,
    cronSecret: opts.cronSecret,
    path: "purge-deleted-submission-drafts",
    log: opts.log,
    // Idempotent: a rollout's missing API pod is worth one more try before the run fails.
    gatewayRetry: DEFAULT_GATEWAY_RETRY,
  });
  if (result.outcome !== "completed") return;
  opts.log.info({ outcome: result.outcome }, "purge deleted submission drafts completed");
}
