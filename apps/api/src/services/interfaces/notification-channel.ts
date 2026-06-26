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

export type NotificationChannelKind = "in_app" | "push" | "email" | "whatsapp";

/** OCP/LSP: pluggable delivery channels for user notifications. */
export interface INotificationChannel {
  readonly channelKind: NotificationChannelKind;
  supports(type: string): boolean;
  send(userId: string, payload: NotificationPayload): Promise<void>;
}
