export type {
  CreatePushSubscriptionRow,
  IPushSubscriptionRepository,
} from "@auction/persistence/interfaces";

export type PushPayload = {
  title: string;
  body: string;
  icon?: string | undefined;
  url?: string | undefined;
  /** Notification tag — dedupes replacements per lot/event type. */
  tag?: string | undefined;
};

export interface IPushSender {
  send(endpoint: string, p256dh: string, auth: string, payload: PushPayload): Promise<boolean>;
}
