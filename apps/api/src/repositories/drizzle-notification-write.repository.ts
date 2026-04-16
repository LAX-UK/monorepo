import type { Database } from "@auction/db";
import { notification } from "@auction/db/schema";
import type {
  CreateNotificationRow,
  INotificationWriteRepository,
} from "../services/interfaces/notification-write.js";

export class DrizzleNotificationWriteRepository implements INotificationWriteRepository {
  constructor(private readonly db: Database) {}

  async createMany(rows: CreateNotificationRow[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.insert(notification).values(
      rows.map((r) => ({
        userId: r.userId,
        type: r.type,
        title: r.title,
        message: r.message,
        auctionId: r.auctionId ?? null,
      })),
    );
  }
}
