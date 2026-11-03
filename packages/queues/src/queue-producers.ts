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

export type WebhookEventsJobData = {
  eventKey: string;
};

export const WEBHOOK_EVENT_PROCESS_JOB_NAME = "process-webhook-event" as const;
export const WEBHOOK_EVENT_DRAIN_JOB_NAME = "webhook-event-drain" as const;

export interface WebhookEventsQueueProducer {
  enqueue(eventKey: string): Promise<void>;
}

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

export function bindWebhookEventsQueue(
  queue: import("bullmq").Queue<WebhookEventsJobData>,
): WebhookEventsQueueProducer {
  return {
    async enqueue(eventKey: string) {
      await queue.add(WEBHOOK_EVENT_PROCESS_JOB_NAME, { eventKey }, { jobId: eventKey });
    },
  };
}

export { LEGAL_ENTITY_ARCHIVE_JOB_NAME };

/** Asks the email provider to stop blocking a person's address. Runs on the email queue. */
export const REACTIVATE_EMAIL_ADDRESS_JOB_NAME = "reactivate-email-address" as const;

/** Carries ids only; the worker looks the address up, so no email address sits in the queue. */
export type ReactivateEmailAddressJobData = {
  userId: string;
  emailHash: string;
};

export interface EmailAddressReactivationProducer {
  request(data: ReactivateEmailAddressJobData): Promise<void>;
}

/** The job retries with backoff, and ends in Failed jobs when it runs out of attempts. */
export function bindEmailAddressReactivationQueue(
  queue: Queue,
  now: () => number = Date.now,
): EmailAddressReactivationProducer {
  return {
    async request(data) {
      await queue.add(REACTIVATE_EMAIL_ADDRESS_JOB_NAME, data, {
        jobId: `reactivate-${data.emailHash}-${now()}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
    },
  };
}
