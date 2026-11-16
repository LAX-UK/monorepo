/**
 * Postgres channel the notification outbox signals when a time-critical row is staged.
 *
 * The signal is sent with `pg_notify` inside the staging transaction, so Postgres delivers it only
 * when that transaction commits (and drops it on rollback). The worker listens on this channel and
 * drains the outbox straight away instead of waiting for the once-a-minute sweep.
 */
export const NOTIFICATION_OUTBOX_WAKE_CHANNEL = "notification_outbox_critical";

/**
 * Notification kinds a bidder or seller acts on within seconds of the event: being outbid while the
 * lot is still open, a lot closing, or a lot about to close. Other kinds keep the minute sweep.
 */
export const CRITICAL_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  "outbid",
  "bid_refused_limit",
  "lot_won",
  "lot_lost",
  "lot_ended_seller",
  "lot_ending_soon",
  "watchlist_ending_soon",
]);

export function isCriticalNotificationType(type: string): boolean {
  return CRITICAL_NOTIFICATION_TYPES.has(type);
}
