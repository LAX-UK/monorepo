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
    /** Canonical lot title for deep links (push/email). */
    lotTitle?: string;
  };
};

export type NotificationChannelKind = "in_app" | "push" | "email" | "whatsapp";

/** OCP/LSP: pluggable delivery channels for user notifications. */
export interface INotificationChannel {
  readonly channelKind: NotificationChannelKind;
  supports(type: string): boolean;
  send(userId: string, payload: NotificationPayload): Promise<void>;
}
