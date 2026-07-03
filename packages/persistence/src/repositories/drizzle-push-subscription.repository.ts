import type { Database } from "@auction/db";
import { pushSubscription } from "@auction/db/schema";
import type { PushSubscriptionRecord } from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type {
  CreatePushSubscriptionRow,
  IPushSubscriptionRepository,
} from "../interfaces/push-subscription.repository.js";

type Row = InferSelectModel<typeof pushSubscription>;

function mapRow(row: Row): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.userId,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    createdAt: row.createdAt,
  };
}

export class DrizzlePushSubscriptionRepository implements IPushSubscriptionRepository {
  constructor(private readonly db: Database) {}

  async findByUser(userId: string): Promise<PushSubscriptionRecord[]> {
    const rows = await this.db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, userId));
    return rows.map(mapRow);
  }

  async create(row: CreatePushSubscriptionRow): Promise<PushSubscriptionRecord> {
    const [inserted] = await this.db
      .insert(pushSubscription)
      .values({
        userId: row.userId,
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: {
          userId: row.userId,
          p256dh: row.p256dh,
          auth: row.auth,
        },
      })
      .returning();
    if (!inserted) throw new Error("push subscription insert failed");
    return mapRow(inserted);
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.db.delete(pushSubscription).where(eq(pushSubscription.endpoint, endpoint));
  }
}
