import type { Logger } from "pino";
import type { IEnquiryQuarantinePurgeRepository } from "../interfaces/enquiry-quarantine-purge.repository.js";

const DEFAULT_BATCH_SIZE = 500;
/** A ceiling on one run, so a fault in the repository can never spin the job forever. */
const MAX_BATCHES = 1000;

/** Runs once a day at 03:40 London time, after the night's other purges. */
export const ENQUIRY_QUARANTINE_PURGE_PATTERN = "40 3 * * *";
export const ENQUIRY_QUARANTINE_PURGE_TIME_ZONE = "Europe/London";

/**
 * Deletes inbound enquiry mail held in quarantine once its `purge_at` (30 days after it arrived)
 * has passed, reviewed or not. Running it again deletes nothing more, so a retried or doubled run
 * is harmless. The log carries counts only: never an address, subject or any text of the mail.
 */
export async function purgeEnquiryInboundQuarantine(input: {
  repository: IEnquiryQuarantinePurgeRepository;
  log: Pick<Logger, "info">;
  batchSize?: number;
  now?: Date;
}): Promise<{ deleted: number; batches: number }> {
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  const now = input.now ?? new Date();
  let deleted = 0;
  let batches = 0;

  while (batches < MAX_BATCHES) {
    const batch = await input.repository.purgeDue(now, batchSize);
    if (batch.batchCount === 0) break;
    batches += 1;
    deleted += batch.deleted;
    if (batch.batchCount < batchSize) break;
  }

  input.log.info({ deleted, batches }, "purge-enquiry-inbound-quarantine: done");
  return { deleted, batches };
}
