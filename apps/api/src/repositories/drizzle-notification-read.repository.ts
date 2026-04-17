import type { Database } from "@auction/db";
import { notification } from "@auction/db/schema";
import type { UserNotification } from "@auction/types";
import type { InferSelectModel, SQL } from "drizzle-orm";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type {
  INotificationReadRepository,
  NotificationListFilter,
} from "../services/interfaces/notification-read.js";

type Row = InferSelectModel<typeof notification>;

function mapRow(row: Row): UserNotification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    auctionId: row.auctionId,
    read: row.read,
    archivedAt: row.archivedAt ?? null,
    createdAt: row.createdAt,
  };
}

export class DrizzleNotificationReadRepository implements INotificationReadRepository {
  constructor(private readonly db: Database) {}

  async findByUser(userId: string, limit: number): Promise<UserNotification[]> {
    const rows = await this.db
      .select()
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.archivedAt)))
      .orderBy(desc(notification.createdAt))
      .limit(limit);
    return rows.map(mapRow);
  }

  async findByUserFiltered(
    userId: string,
    filter: NotificationListFilter,
  ): Promise<UserNotification[]> {
    const parts: SQL[] = [eq(notification.userId, userId)];
    if (filter.tab === "archived") {
      parts.push(isNotNull(notification.archivedAt));
    } else if (filter.tab === "unread") {
      parts.push(isNull(notification.archivedAt));
      parts.push(eq(notification.read, false));
    } else {
      parts.push(isNull(notification.archivedAt));
    }
    if (filter.type) {
      parts.push(eq(notification.type, filter.type));
    }
    const rows = await this.db
      .select()
      .from(notification)
      .where(and(...parts))
      .orderBy(desc(notification.createdAt))
      .limit(filter.limit)
      .offset(filter.offset);
    return rows.map(mapRow);
  }

  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.db
      .update(notification)
      .set({ read: true })
      .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
      .returning({ id: notification.id });
    return result.length > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.db
      .update(notification)
      .set({ read: true })
      .where(
        and(
          eq(notification.userId, userId),
          eq(notification.read, false),
          isNull(notification.archivedAt),
        ),
      )
      .returning({ id: notification.id });
    return result.length;
  }

  async markManyRead(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.db
      .update(notification)
      .set({ read: true })
      .where(
        and(
          eq(notification.userId, userId),
          inArray(notification.id, ids),
          isNull(notification.archivedAt),
        ),
      )
      .returning({ id: notification.id });
    return result.length;
  }

  async archive(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.db
      .update(notification)
      .set({ archivedAt: new Date() })
      .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
      .returning({ id: notification.id });
    return result.length > 0;
  }
}
