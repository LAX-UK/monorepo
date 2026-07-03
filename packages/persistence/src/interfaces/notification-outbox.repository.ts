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
  /** Structured extras for email/push rendering (not persisted on in-app rows). */
  meta?: {
    paymentId?: string;
    amount?: string;
    invoiceUrl?: string | null;
    invoiceNumber?: string;
    /** Payment due date for invoice emails (human-readable, e.g. "7 July 2026"). */
    dueDate?: string;
    /** Hammer price for lot-won celebration emails. */
    hammerPrice?: string;
    /** Total due (hammer + premium) for lot-won emails. */
    totalDue?: string;
    /** Canonical lot title for deep links (push/email). */
    lotTitle?: string;
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
