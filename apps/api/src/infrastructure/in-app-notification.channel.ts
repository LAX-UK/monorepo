import type { ICacheProvider } from "../services/interfaces/cache.js";
import type {
  INotificationChannel,
  NotificationPayload,
} from "../services/interfaces/notification-channel.js";
import type { INotificationWriteRepository } from "../services/interfaces/notification-write.js";
import type { IUserNotificationPublisher } from "../services/interfaces/user-notification-publisher.js";

const OUTBOX_DEDUPE_TTL_SEC = 7 * 86_400;

export class InAppNotificationChannel implements INotificationChannel {
  readonly channelKind = "in_app" as const;

  constructor(
    private readonly write: INotificationWriteRepository,
    private readonly publisher: IUserNotificationPublisher,
    private readonly cache: ICacheProvider | null = null,
  ) {}

  supports(_type: string): boolean {
    return true;
  }

  async send(userId: string, payload: NotificationPayload): Promise<void> {
    const dedupeKey = payload.meta?.outboxIdempotencyKey;
    if (dedupeKey && this.cache) {
      const cacheKey = `notification:dedupe:${dedupeKey}`;
      if (await this.cache.get(cacheKey)) return;
    }

    const rows = await this.write.createMany([
      {
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        lotId: payload.lotId,
        submissionId: payload.submissionId,
      },
    ]);

    if (dedupeKey && this.cache) {
      await this.cache.set(`notification:dedupe:${dedupeKey}`, "1", OUTBOX_DEDUPE_TTL_SEC);
    }

    for (const row of rows) {
      await this.publisher.publish(row.userId, row);
    }
  }
}
