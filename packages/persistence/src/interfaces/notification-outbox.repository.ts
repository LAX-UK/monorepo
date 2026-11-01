import type { Database } from "@auction/db";

/**
 * Notification payload persisted in the outbox `payload` JSON column.
 * Delivery-channel contracts (INotificationChannel) live in the api layer.
 */
export type NotificationPayload = {
  type: string;
  title: string;
  message: string;
  lotId?: string | undefined;
  submissionId?: string | undefined;
  /**
   * The account the notification is about (a personal or organisation legal entity); `null`
   * means the person's own personal account. Required so every producer decides it.
   */
  legalEntityId: string | null;
  /** Structured extras for email/push rendering (not persisted on in-app rows). */
  meta?: {
    paymentId?: string;
    amount?: string;
    invoiceUrl?: string | null;
    invoiceNumber?: string;
    /** Payment due date for invoice emails (human-readable, e.g. "7 July 2026"). */
    dueDate?: string;
    /** How a lot ended, for the seller's sold or unsold notice. */
    outcome?: "sold" | "unsold";
    /** The bid this notification is about, in major units: the new high bid for an outbid
     *  notice, the winning bid for a lot-won notice. */
    bidAmount?: string;
    /** Hammer price for lot-won celebration emails. */
    hammerPrice?: string;
    /** Total due (hammer + premium) for lot-won emails. */
    totalDue?: string;
    /** Currency (ISO 4217) of every amount in this payload; the platform default when absent. */
    currency?: string;
    /** Who the notification is for, where one event notifies both sides of a sale. */
    audience?: "buyer" | "seller" | "staff";
    /** Canonical lot title for deep links (push/email). */
    lotTitle?: string;
    /** Carrier and tracking number of a shipped lot. */
    carrier?: string;
    trackingNumber?: string;
    /** Where a lot is collected, as one line of text, when the sale has a venue. */
    collectionPlace?: string;
    /** How a delivered lot reached its buyer. */
    fulfilmentMethod?: "delivery" | "collection";
    /** The organisation a notice is about, by name, for its email. */
    organisationName?: string;
    /** Last four digits of a new payout bank account. */
    bankLast4?: string | null;
    /** A reminder the person set on a watched lot: which one, their note and when it closes. */
    watchedLotReminder?: {
      kind: "sale_start" | "day_before_close" | "hour_before_close";
      note: string | null;
      closesAt: string;
    };
    /**
     * The invoices one payment settled together, each with its amount (major units, `currency`);
     * `amount` is then their total.
     */
    receiptLines?: { lotTitle: string; lotNumber: number | null; amount: string }[];
    /** How a payment was made. */
    paymentMethod?: "card" | "bank_transfer";
    /** Keeps an email for one fulfilment step from being queued twice. */
    emailIdempotencyKey?: string;
    /** Outbox idempotency key — used by in-app channel to skip duplicate retries. */
    outboxIdempotencyKey?: string;
  };
};

export type NotificationOutboxRow = {
  id: string;
  idempotencyKey: string;
  userId: string;
  payload: NotificationPayload;
  state: "pending" | "claimed" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  processedAt: Date | null;
  claimedAt: Date | null;
};

export type StageNotificationOutboxInput = {
  userId: string;
  payload: NotificationPayload;
  idempotencyKey: string;
};

export interface INotificationOutboxRepository {
  stage(input: StageNotificationOutboxInput, tx?: Database): Promise<boolean>;
  claim(batchSize: number): Promise<NotificationOutboxRow[]>;
  ack(ids: string[]): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  countPending(): Promise<number>;
}
