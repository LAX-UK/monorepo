export type NotificationPayload = {
  type: string;
  title: string;
  message: string;
  lotId?: string | undefined;
};

export type NotificationChannelKind = "in_app" | "push";

/** OCP/LSP: pluggable delivery channels for user notifications. */
export interface INotificationChannel {
  readonly channelKind: NotificationChannelKind;
  supports(type: string): boolean;
  send(userId: string, payload: NotificationPayload): Promise<void>;
}
