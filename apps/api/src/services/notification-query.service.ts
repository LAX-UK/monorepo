import type { UserNotification } from "@auction/types";
import type { INotificationReadRepository } from "./interfaces/notification-read.js";

/** SRP: persisted notification reads for the dashboard / header. */
export class NotificationQueryService {
  constructor(private readonly notifications: INotificationReadRepository) {}

  listForUser(userId: string, limit: number): Promise<UserNotification[]> {
    return this.notifications.findByUser(userId, limit);
  }

  markRead(userId: string, notificationId: string): Promise<boolean> {
    return this.notifications.markRead(userId, notificationId);
  }
}
