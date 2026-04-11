import type { UserNotification } from "@auction/types";

export interface INotificationReadRepository {
  findByUser(userId: string, limit: number): Promise<UserNotification[]>;
  markRead(userId: string, notificationId: string): Promise<boolean>;
}
