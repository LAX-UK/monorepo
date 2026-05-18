import type { IMarketingEventPublisher } from "@auction/marketing-events";
import type { PublishOutcome, ResolvedMarketingEvent } from "@auction/types";

export class NoopMarketingEventPublisher implements IMarketingEventPublisher {
  async publish(_event: ResolvedMarketingEvent): Promise<PublishOutcome> {
    return { status: "skipped", reason: "marketing_events_disabled" };
  }
}
