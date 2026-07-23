import type { UserHttpJson } from "./user-route-http.js";

export interface IUserNotificationsHttpApplicationService {
  listNotifications(input: {
    userId: string;
    limit: number;
    offset: number;
    tab: "all" | "unread" | "archived";
    type?: string;
  }): Promise<UserHttpJson>;

  markManyRead(input: { userId: string; ids: string[] }): Promise<UserHttpJson>;

  archiveNotification(input: { userId: string; notificationId: string }): Promise<UserHttpJson>;

  markRead(input: { userId: string; notificationId: string }): Promise<UserHttpJson>;

  markAllRead(input: { userId: string }): Promise<UserHttpJson>;
}
