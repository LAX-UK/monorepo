import type { UserNotification, UserNotificationListItem } from "@auction/types";

/** `needs_action`: unread notifications that ask the person to do something. */
export type NotificationListTab = "all" | "unread" | "archived" | "needs_action";

/** Narrows the inbox to one account: the person's own (`personal`) or one legal entity. */
export type NotificationAccountFilter =
  | { kind: "personal" }
  | { kind: "entity"; legalEntityId: string };

export type NotificationListFilter = {
  limit: number;
  offset: number;
  tab: NotificationListTab;
  type?: string | undefined;
  account?: NotificationAccountFilter | undefined;
  /** Words to find in the title or message, case-insensitively. */
  query?: string | undefined;
};

export interface INotificationReadRepository {
  findByUser(userId: string, limit: number): Promise<UserNotification[]>;
  /** The inbox page, each row with its account and whether it needs action. */
  findByUserFiltered(
    userId: string,
    filter: NotificationListFilter,
  ): Promise<UserNotificationListItem[]>;
  markRead(userId: string, notificationId: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  markManyRead(userId: string, ids: string[]): Promise<number>;
  archive(userId: string, notificationId: string): Promise<boolean>;
}
