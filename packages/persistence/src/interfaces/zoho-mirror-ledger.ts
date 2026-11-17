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
  /** The delivery consumer the rows were read from. */
  consumer: string;
  /** Each asked-for id with its deliveries, oldest event first; ids with none are present and empty. */
  deliveries: Map<string, ZohoMirrorLedgerDelivery[]>;
};

/** Reads what the Zoho mirror consumers did for a record; changes nothing. */
export interface IZohoMirrorLedgerReader {
  read(entity: ZohoMirrorLedgerEntity, ids: readonly string[]): Promise<ZohoMirrorLedger>;
}
