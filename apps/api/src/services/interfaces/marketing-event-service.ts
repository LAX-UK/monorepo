import type { Database } from "@auction/db";
import type { MarketingEvent } from "@auction/types";

export interface IMarketingEventService {
  /** Append to outbox inside an open DB transaction; call {@link enqueue} after commit. */
  stage(event: MarketingEvent, tx: Database): Promise<void>;
  /** Append to outbox and enqueue immediately (no domain transaction). */
  emit(event: MarketingEvent): Promise<void>;
  /** Enqueue a previously staged event after the transaction commits. */
  enqueue(event: MarketingEvent): Promise<void>;
}
