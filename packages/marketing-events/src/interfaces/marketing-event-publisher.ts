import type { PublishOutcome, ResolvedMarketingEvent } from "@auction/types";

export interface IMarketingEventPublisher {
  publish(event: ResolvedMarketingEvent): Promise<PublishOutcome>;
}
