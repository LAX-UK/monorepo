import type { ZohoMirrorEntity } from "@auction/shop-contracts";

/** One consumer's delivery of one event for a record, as the delivery ledger holds it. */
export type MirrorDelivery = {
  eventId: number;
  /** The event's type: which of the record's writes this delivery made. */
  eventType: string;
  status: "pending" | "processing" | "succeeded" | "skipped" | "retryable" | "dead_lettered";
  attempts: number;
  nextRetryAt: Date | null;
  providerReference: string | null;
  /** Redacted when written; for a skipped delivery it is the skip reason. */
  lastError: string | null;
  updatedAt: Date;
};

export type MirrorLedger = {
  consumer: string;
  /** Every asked-for id, with its deliveries oldest event first. */
  deliveries: Map<string, MirrorDelivery[]>;
};

export interface ZohoMirrorLedgerReader {
  read(entity: ZohoMirrorEntity, ids: readonly string[]): Promise<MirrorLedger>;
}

/** Whether Shop orders are paid; the order mirror sends only paid orders. */
export interface OrderPaymentStateReader {
  /** Each order found, true when it is paid; an id with no order is absent. */
  paidOf(orderIds: readonly string[]): Promise<Map<string, boolean>>;
}
