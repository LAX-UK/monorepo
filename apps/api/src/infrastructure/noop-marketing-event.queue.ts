import type { MarketingEvent } from "@auction/types";
import type { IMarketingEventQueue } from "../services/interfaces/marketing-event-queue.js";

export class NoopMarketingEventQueue implements IMarketingEventQueue {
  async enqueue(_event: MarketingEvent): Promise<void> {
    /* prod gate off */
  }
}
