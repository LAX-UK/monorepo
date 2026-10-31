import type {
  NotificationAccountFilter,
  NotificationListTab,
} from "@auction/persistence/interfaces";
import type { UserHttpJson } from "./user-route-http.js";

export interface IUserNotificationsHttpApplicationService {
  /** The inbox page; each item carries its account and whether it needs action. */
  listNotifications(input: {
    userId: string;
    limit: number;
    offset: number;
    tab: NotificationListTab;
    type?: string;
    account?: NotificationAccountFilter;
    query?: string;
  }): Promise<UserHttpJson>;

  markManyRead(input: { userId: string; ids: string[] }): Promise<UserHttpJson>;

  archiveNotification(input: { userId: string; notificationId: string }): Promise<UserHttpJson>;

  markRead(input: { userId: string; notificationId: string }): Promise<UserHttpJson>;

  markAllRead(input: { userId: string }): Promise<UserHttpJson>;

  /** Organisations the person has muted. */
  listMutes(input: { userId: string }): Promise<UserHttpJson>;

  muteAccount(input: { userId: string; legalEntityId: string }): Promise<UserHttpJson>;

  unmuteAccount(input: { userId: string; legalEntityId: string }): Promise<UserHttpJson>;
}
