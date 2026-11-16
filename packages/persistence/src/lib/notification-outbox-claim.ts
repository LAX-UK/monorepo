/**
 * The outbox only claims rows staged at least this long ago, so a transaction that inserted a row
 * just before a drain started has committed by the time the row is taken (the claim guard).
 */
export const NOTIFICATION_OUTBOX_CLAIM_GUARD_MS = 1_000;

/** A row that failed this many times is marked `failed` and never claimed again. */
export const NOTIFICATION_OUTBOX_MAX_ATTEMPTS = 10;

/** Wait after the first failed attempt before a row is claimed again; doubles per attempt. */
export const NOTIFICATION_OUTBOX_RETRY_BASE_MS = 15_000;

/** Longest wait between two attempts at one row. */
export const NOTIFICATION_OUTBOX_RETRY_MAX_MS = 5 * 60_000;

/**
 * How long a row that has failed `attempts` times waits, after its last attempt, before a drain may
 * claim it again: 15 s, 30 s, 1 min, 2 min, 4 min, then 5 min. However often drains run (a wake
 * every 250 ms during a live sale, or the minute sweep), a row is tried at most once per step, so
 * the ten attempts span about 28 minutes and a short outage cannot use them up.
 */
export function notificationOutboxRetryDelayMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.min(
    NOTIFICATION_OUTBOX_RETRY_MAX_MS,
    NOTIFICATION_OUTBOX_RETRY_BASE_MS * 2 ** (attempts - 1),
  );
}
