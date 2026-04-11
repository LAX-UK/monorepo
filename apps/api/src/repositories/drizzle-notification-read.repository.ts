import type { Database } from "@auction/db";
import { notification } from "@auction/db/schema";
import type { UserNotification } from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq } from "drizzle-orm";
import type { INotificationReadRepository } from "../services/interfaces/notification-read.js";

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
    createdAt: row.createdAt,
  };
}

export class DrizzleNotificationReadRepository implements INotificationReadRepository {
  constructor(private readonly db: Database) {}

  async findByUser(userId: string, limit: number): Promise<UserNotification[]> {
    const rows = await this.db
      .select()
      .from(notification)
      .where(eq(notification.userId, userId))
      .orderBy(desc(notification.createdAt))
      .limit(limit);
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
}
