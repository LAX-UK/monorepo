import type { Database } from "@auction/db";
import type { MarketingEventOutboxState } from "@auction/db/schema";
import type { MarketingEvent } from "@auction/types";

export type MarketingEventOutboxRow = {
  id: string;
  eventId: string;
  name: string;
  payload: MarketingEvent;
  state: MarketingEventOutboxState;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
};

export interface IMarketingEventOutboxRepository {
  /** @returns true when a new row was inserted, false on duplicate eventId or when disabled (noop). */
  append(event: MarketingEvent, tx?: Database): Promise<boolean>;
  claim(batchSize: number): Promise<MarketingEventOutboxRow[]>;
  ack(ids: string[]): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  /** Inserts or updates a row to `skipped` (audit trail for consent-denied emits). */
  markSkipped(event: MarketingEvent, reason: string, tx?: Database): Promise<void>;
}
