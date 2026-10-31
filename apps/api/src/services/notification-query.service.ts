import type {
  INotificationReadRepository,
  NotificationCountFilter,
  NotificationCounts,
  NotificationListFilter,
} from "@auction/persistence/interfaces";
import type { UserNotification, UserNotificationListItem } from "@auction/types";

/** SRP: persisted notification reads for the dashboard / header. */
export class NotificationQueryService {
  constructor(private readonly notifications: INotificationReadRepository) {}

  listForUser(userId: string, limit: number): Promise<UserNotification[]> {
    return this.notifications.findByUser(userId, limit);
  }

  listForUserFiltered(
    userId: string,
    filter: NotificationListFilter,
  ): Promise<UserNotificationListItem[]> {
    return this.notifications.findByUserFiltered(userId, filter);
  }

  countForUser(userId: string, filter: NotificationCountFilter): Promise<NotificationCounts> {
    return this.notifications.countByUser(userId, filter);
  }

  markRead(userId: string, notificationId: string): Promise<boolean> {
    return this.notifications.markRead(userId, notificationId);
  }

  markAllRead(userId: string): Promise<number> {
    return this.notifications.markAllRead(userId);
  }

  markManyRead(userId: string, ids: string[]): Promise<number> {
    return this.notifications.markManyRead(userId, ids);
  }

  archive(userId: string, notificationId: string): Promise<boolean> {
    return this.notifications.archive(userId, notificationId);
  }
}
