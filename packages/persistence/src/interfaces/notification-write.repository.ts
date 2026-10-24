import type { UserNotification } from "@auction/types";
import type { NotificationPayload } from "./notification-outbox.repository.js";

export type CreateNotificationRow = {
  userId: string;
  type: string;
  title: string;
  message: string;
  lotId?: string | undefined;
  submissionId?: string | undefined;
  /** Ephemeral fields for email/push channels (not stored on `notification` rows). */
  meta?: NotificationPayload["meta"];
};

export interface INotificationWriteRepository {
  createMany(rows: CreateNotificationRow[]): Promise<UserNotification[]>;
}
