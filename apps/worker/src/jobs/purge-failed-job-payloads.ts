import type { IFailedJobPayloadPurge } from "@auction/persistence/interfaces";
import { FAILED_JOB_RESOLVED_RETENTION_DAYS } from "@auction/types";

type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

/** Runs once a day at 02:00 UTC, matching the fixed crontab of its Sentry cron monitor. */
export const FAILED_JOB_PAYLOADS_PURGE_PATTERN = "0 2 * * *";
export const FAILED_JOB_PAYLOADS_PURGE_TIME_ZONE = "UTC";
export const FAILED_JOB_PAYLOADS_PURGE_JOB_ID = "purge-failed-job-payloads-daily";

const DAY_MS = 86_400_000;
const DEFAULT_BATCH_SIZE = 500;
/** Bounds one run; the next day's run takes up what is left. */
const MAX_BATCHES_PER_RUN = 200;

/**
 * Clears the stored payload of failed jobs that were retried or discarded more than 90 days ago
 * (`FAILED_JOB_RESOLVED_RETENTION_DAYS`, also the window a discard can be restored in). The
 * record, its error text and its audit trail stay; only `payload_json` goes. A job still waiting
 * for review keeps its payload however old it is, and a cleared row no longer matches, so running
 * it again changes nothing. It works in small batches.
 */
export async function purgeFailedJobPayloads(input: {
  purge: IFailedJobPayloadPurge;
  log: Logger;
  now?: Date;
  batchSize?: number;
}): Promise<{ cleared: number; batches: number }> {
  const now = input.now ?? new Date();
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  const cutoff = new Date(now.getTime() - FAILED_JOB_RESOLVED_RETENTION_DAYS * DAY_MS);
  let cleared = 0;
  let batches = 0;

  while (batches < MAX_BATCHES_PER_RUN) {
    const batch = await input.purge.purgeResolvedPayloads(cutoff, batchSize);
    batches += 1;
    cleared += batch;
    if (batch < batchSize) break;
  }

  if (batches === MAX_BATCHES_PER_RUN) {
    input.log.warn({ cleared, batches }, "purge-failed-job-payloads: stopped at the batch limit");
  }
  input.log.info({ cleared, batches, cutoff }, "purge-failed-job-payloads: done");
  return { cleared, batches };
}
