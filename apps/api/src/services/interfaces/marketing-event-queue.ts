import type { MarketingEvent } from "@auction/types";

export interface IMarketingEventQueue {
  enqueue(event: MarketingEvent): Promise<void>;
}
