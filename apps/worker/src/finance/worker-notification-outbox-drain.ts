import type { INotificationOutboxCronProcessor } from "@auction/finance-cron-app";
import type {
  INotificationOutboxRepository,
  INotificationWriteRepository,
} from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";

const DEDUPE_TTL_SEC = 7 * 86_400;

/** Drains notification_outbox into in-app notifications + Redis fanout (worker-local). */
export class WorkerNotificationOutboxDrain implements INotificationOutboxCronProcessor {
  constructor(
    private readonly deps: {
      outbox: INotificationOutboxRepository;
      notificationWrite: INotificationWriteRepository;
      redis: Redis;
    },
  ) {}

  async processBatch(batchSize = 50) {
    const rows = await this.deps.outbox.claim(batchSize);
    let processed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const dedupeKey = row.idempotencyKey;
        if (dedupeKey) {
          const cacheKey = `notification:dedupe:${dedupeKey}`;
          const existing = await this.deps.redis.get(cacheKey);
          if (existing) {
            await this.deps.outbox.ack([row.id]);
            processed += 1;
            continue;
          }
        }

        const created = await this.deps.notificationWrite.createMany([
          {
            userId: row.userId,
            type: row.payload.type,
            title: row.payload.title,
            message: row.payload.message,
            lotId: row.payload.lotId,
            submissionId: row.payload.submissionId,
          },
        ]);

        if (dedupeKey) {
          await this.deps.redis.set(`notification:dedupe:${dedupeKey}`, "1", "EX", DEDUPE_TTL_SEC);
        }

        for (const notification of created) {
          await this.deps.redis.publish(
            `user:${notification.userId}:notifications`,
            JSON.stringify({ type: "user_notification", notification }),
          );
        }

        await this.deps.outbox.ack([row.id]);
        processed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.deps.outbox.fail(row.id, message);
        failed += 1;
      }
    }

    const pendingDepth = await this.deps.outbox.countPending();
    return { processed, failed, pendingDepth };
  }
}
