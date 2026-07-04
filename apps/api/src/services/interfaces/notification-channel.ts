import type { NotificationPayload } from "@auction/persistence/interfaces";

/** Row-level payload type lives with the outbox port in @auction/persistence. */
export type { NotificationPayload } from "@auction/persistence/interfaces";

export type NotificationChannelKind = "in_app" | "push" | "email" | "whatsapp";

/** OCP/LSP: pluggable delivery channels for user notifications. */
export interface INotificationChannel {
  readonly channelKind: NotificationChannelKind;
  supports(type: string): boolean;
  send(userId: string, payload: NotificationPayload): Promise<void>;
}
