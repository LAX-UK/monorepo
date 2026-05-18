import type { Database } from "@auction/db";
import type { MarketingEvent } from "@auction/types";
import type { IMarketingEventOutboxRepository } from "../services/interfaces/marketing-event-outbox.js";

/** No-op outbox when marketing events are disabled (avoids filling DB with undrainable rows). */
export class NoopMarketingEventOutboxRepository implements IMarketingEventOutboxRepository {
  async append(_event: MarketingEvent, _tx?: Database): Promise<boolean> {
    return false;
  }

  async claim(_batchSize: number) {
    return [];
  }

  async ack(_ids: string[]): Promise<void> {}

  async fail(_id: string, _error: string): Promise<void> {}

  async markSkipped(_event: MarketingEvent, _reason: string, _tx?: Database): Promise<void> {}
}
