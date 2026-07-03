import type { PushSubscriptionRecord } from "@auction/types";

export type CreatePushSubscriptionRow = {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export interface IPushSubscriptionRepository {
  findByUser(userId: string): Promise<PushSubscriptionRecord[]>;
  create(row: CreatePushSubscriptionRow): Promise<PushSubscriptionRecord>;
  deleteByEndpoint(endpoint: string): Promise<void>;
}
