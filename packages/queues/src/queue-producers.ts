import type { JobsOptions, Queue } from "bullmq";
import {
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
