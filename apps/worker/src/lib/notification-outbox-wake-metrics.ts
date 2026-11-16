import { Counter, type Registry } from "prom-client";

/**
 * Wake drains of the notification outbox by outcome: `drained` (every claimed row delivered),
 * `rows_failed` (the drain ran but some sends failed; those rows wait out their retry backoff) and
 * `drain_failed` (the drain job itself threw). A rising failure rate means time-critical notices
 * are falling back to retries and the minute sweep.
 */
export const notificationOutboxWakeTotal = new Counter({
  name: "auction_worker_notification_outbox_wake_total",
  help: "Notification outbox wake drains by outcome",
  labelNames: ["outcome"] as const,
});

/** Rows whose send failed during a wake drain. */
export const notificationOutboxWakeFailedRowsTotal = new Counter({
  name: "auction_worker_notification_outbox_wake_failed_rows_total",
  help: "Notification outbox rows whose send failed during a wake drain",
});

export function bindNotificationOutboxWakeMetrics(reg: Registry): void {
  reg.registerMetric(notificationOutboxWakeTotal);
  reg.registerMetric(notificationOutboxWakeFailedRowsTotal);
}
