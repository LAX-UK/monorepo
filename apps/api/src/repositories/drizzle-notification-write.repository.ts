import type { Database } from "@auction/db";
import { notification } from "@auction/db/schema";
import type { UserNotification } from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";
import type {
  CreateNotificationRow,
  INotificationWriteRepository,
} from "../services/interfaces/notification-write.js";

type Row = InferSelectModel<typeof notification>;

function mapRow(row: Row): UserNotification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    lotId: row.lotId,
    submissionId: row.submissionId,
    read: row.read,
    archivedAt: row.archivedAt ?? null,
    createdAt: row.createdAt,
  };
}

export class DrizzleNotificationWriteRepository implements INotificationWriteRepository {
  constructor(private readonly db: Database) {}

  async createMany(rows: CreateNotificationRow[]): Promise<UserNotification[]> {
    if (rows.length === 0) return [];
    const inserted = await this.db
      .insert(notification)
      .values(
        rows.map((r) => ({
          userId: r.userId,
          type: r.type,
          title: r.title,
          message: r.message,
          lotId: r.lotId ?? null,
          submissionId: r.submissionId ?? null,
        })),
      )
      .returning();
    return inserted.map(mapRow);
  }
}
