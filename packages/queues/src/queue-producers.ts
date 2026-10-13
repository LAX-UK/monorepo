import type { JobsOptions, Queue } from "bullmq";
import {
  type AtgSyncJob,
  type AtgSyncJobName,
  LEGAL_ENTITY_ARCHIVE_JOB_NAME,
  type LegalEntityArchiveJobData,
  type LegalEntityArchiveJobName,
} from "./exports.js";

/** Minimal legal-entity archive queue surface for API producers. */
export interface LegalEntityArchiveQueueProducer {
  add(
    name: LegalEntityArchiveJobName,
    data: LegalEntityArchiveJobData,
    opts?: JobsOptions | undefined,
  ): Promise<unknown>;
  close(): Promise<void>;
}

/** Adapts a BullMQ queue for {@link LegalEntityArchiveQueueProducer}. */
export function bindLegalEntityArchiveQueue(queue: Queue): LegalEntityArchiveQueueProducer {
  return queue as LegalEntityArchiveQueueProducer;
}

export { LEGAL_ENTITY_ARCHIVE_JOB_NAME };

/** Minimal ATG sync queue surface for API producers. */
export interface AtgSyncQueueProducer {
  add(
    name: AtgSyncJobName,
    data: AtgSyncJob["data"],
    opts?: JobsOptions | undefined,
  ): Promise<unknown>;
  close(): Promise<void>;
}

/** Adapts a BullMQ queue for {@link AtgSyncQueueProducer}. */
export function bindAtgSyncQueue(queue: Queue): AtgSyncQueueProducer {
  return queue as AtgSyncQueueProducer;
}
