import { Counter, Gauge } from "prom-client";
import type {
  INotificationOutboxProcessor,
  INotificationOutboxRepository,
} from "./interfaces/notification-outbox.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";

const notificationOutboxProcessedTotal = new Counter({
  name: "notification_outbox_processed_total",
  help: "Notification outbox rows successfully dispatched",
});

const notificationOutboxFailedTotal = new Counter({
  name: "notification_outbox_failed_total",
  help: "Notification outbox rows that failed dispatch and were marked for retry or terminal failure",
});

const notificationOutboxQueueDepth = new Gauge({
  name: "notification_outbox_queue_depth",
  help: "Pending notification outbox rows awaiting dispatch",
});

export class NotificationOutboxProcessor implements INotificationOutboxProcessor {
  constructor(
    private readonly outbox: INotificationOutboxRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async processBatch(batchSize = 50): Promise<{
    processed: number;
    failed: number;
    pendingDepth: number;
  }> {
    const rows = await this.outbox.claim(batchSize);
    let processed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        await this.dispatcher.dispatchStrict(row.userId, {
          ...row.payload,
          meta: {
            ...row.payload.meta,
            outboxIdempotencyKey: row.idempotencyKey,
          },
        });
        await this.outbox.ack([row.id]);
        notificationOutboxProcessedTotal.inc();
        processed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.outbox.fail(row.id, message);
        notificationOutboxFailedTotal.inc();
        failed += 1;
      }
    }

    const pendingDepth = await this.outbox.countPending();
    notificationOutboxQueueDepth.set(pendingDepth);
    return { processed, failed, pendingDepth };
  }
}
