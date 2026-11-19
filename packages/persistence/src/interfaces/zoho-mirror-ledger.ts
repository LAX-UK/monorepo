import type { ZohoMirrorRecord } from "@auction/types";

/** The records whose Zoho mirror the ledger can be asked about. */
export type ZohoMirrorLedgerEntity = ZohoMirrorRecord;

export type DeliveryLedgerStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "skipped"
  | "retryable"
  | "dead_lettered";

/** One consumer's delivery of one event for a record, as `domain_event_delivery` holds it. */
export type ZohoMirrorLedgerDelivery = {
  /** The consumer that made the delivery: an artwork's writeback or its LAX listing. */
  consumer: string;
  eventId: number;
  /** The event's type: which of the record's writes this delivery made. */
  eventType: string;
  status: DeliveryLedgerStatus;
  attempts: number;
  nextRetryAt: Date | null;
  providerReference: string | null;
  /** Redacted when written; for a skipped delivery it is the skip reason. */
  lastError: string | null;
  updatedAt: Date;
};

export type ZohoMirrorLedger = {
  /** The record's own mirror consumer (an artwork's listing deliveries are read alongside it). */
  consumer: string;
  /**
   * Each asked-for id with its deliveries, oldest event first (on one event, the record's own
   * consumer first); ids with none are present and empty.
   */
  deliveries: Map<string, ZohoMirrorLedgerDelivery[]>;
  /**
   * Artworks only: for each asked-for id whose stock code conflicts staff have all resolved
   * (accepted Zoho's code or kept LAX's), when the last one was resolved. An id with an open
   * stock code conflict, or none ever, is absent. A stock code conflict skip recorded before this
   * is settled: no further stock code delivery comes after a resolution.
   */
  stockCodeConflictResolvedAt?: Map<string, Date>;
};

/** Reads what the Zoho mirror consumers did for a record; changes nothing. */
export interface IZohoMirrorLedgerReader {
  read(entity: ZohoMirrorLedgerEntity, ids: readonly string[]): Promise<ZohoMirrorLedger>;
}
