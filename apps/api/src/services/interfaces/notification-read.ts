import type { UserNotification } from "@auction/types";

export type NotificationListTab = "all" | "unread" | "archived";

export type NotificationListFilter = {
  limit: number;
  offset: number;
  tab: NotificationListTab;
  type?: string | undefined;
};

export interface INotificationReadRepository {
  findByUser(userId: string, limit: number): Promise<UserNotification[]>;
  findByUserFiltered(userId: string, filter: NotificationListFilter): Promise<UserNotification[]>;
  markRead(userId: string, notificationId: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  markManyRead(userId: string, ids: string[]): Promise<number>;
  archive(userId: string, notificationId: string): Promise<boolean>;
}
