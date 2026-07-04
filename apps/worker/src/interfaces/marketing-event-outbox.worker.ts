import type { MarketingEvent, PublishOutcome } from "@auction/types";

export const MARKETING_OUTBOX_MAX_ATTEMPTS = 10;

export type MarketingFailureOutcome = {
  nextAttempts: number;
  attemptsExceeded: boolean;
  shouldRetry: boolean;
};

/** Worker-side marketing outbox claim and publish-outcome persistence. */
export interface IMarketingEventOutboxWorker {
  claimSingle(eventId: string): Promise<boolean>;
  claimStuckBatch(batchSize: number): Promise<MarketingEvent[]>;
  applyPublishOutcome(
    event: MarketingEvent,
    outcome: PublishOutcome,
  ): Promise<MarketingFailureOutcome | null>;
}
