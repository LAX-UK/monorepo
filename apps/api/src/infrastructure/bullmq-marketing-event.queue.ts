import type { MarketingEvent } from "@auction/types";
import type { Queue } from "bullmq";
import type { IMarketingEventQueue } from "../services/interfaces/marketing-event-queue.js";

export const MARKETING_EVENTS_QUEUE_NAME = "marketing-events";
export const MARKETING_EVENTS_MAX_ATTEMPTS = 10;

export class BullmqMarketingEventQueue implements IMarketingEventQueue {
  constructor(private readonly queue: Queue) {}

  async enqueue(event: MarketingEvent): Promise<void> {
    await this.queue.add("publish", event, {
      jobId: event.eventId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: MARKETING_EVENTS_MAX_ATTEMPTS,
      backoff: { type: "exponential", delay: 5000 },
    });
  }
}
