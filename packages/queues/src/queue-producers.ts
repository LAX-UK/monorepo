import type { AtgSyncJobState } from "@auction/types";
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
  getJobState(jobId: string): Promise<AtgSyncJobState>;
  close(): Promise<void>;
}

/** Adapts a BullMQ queue for {@link AtgSyncQueueProducer}. */
export function bindAtgSyncQueue(queue: Queue): AtgSyncQueueProducer {
  return {
    add: (name, data, opts) => queue.add(name, data, opts),
    close: () => queue.close(),
    async getJobState(jobId: string): Promise<AtgSyncJobState> {
      const job = await queue.getJob(jobId);
      if (!job) return "done";
      const state = await job.getState();
      if (state === "completed" || state === "unknown") return "done";
      if (state === "failed") return "failed";
      if (state === "active") return "active";
      return "waiting";
    },
  };
}
