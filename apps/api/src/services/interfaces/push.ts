import type { PushSubscriptionRecord } from "@auction/types";

export type PushPayload = {
  title: string;
  body: string;
  icon?: string | undefined;
  url?: string | undefined;
};

export type CreatePushSubscriptionRow = {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export interface IPushSender {
  send(endpoint: string, p256dh: string, auth: string, payload: PushPayload): Promise<boolean>;
}

export interface IPushSubscriptionRepository {
  findByUser(userId: string): Promise<PushSubscriptionRecord[]>;
  create(row: CreatePushSubscriptionRow): Promise<PushSubscriptionRecord>;
  deleteByEndpoint(endpoint: string): Promise<void>;
}
