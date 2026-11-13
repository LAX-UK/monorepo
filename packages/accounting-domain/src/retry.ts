/**
 * How often a document is tried before a person takes it. Each attempt is one lease (one
 * `startSending`); a document that has used them all and still has not reached the books goes to
 * `needs_review` through `escalate`, so it is never retried forever.
 */
export const MAX_SEND_ATTEMPTS = 8;

/** The first wait after a failed attempt; it doubles each time, up to `RETRY_MAX_DELAY_MS`. */
export const RETRY_BASE_DELAY_MS = 30_000;
export const RETRY_MAX_DELAY_MS = 30 * 60_000;

/**
 * How long to wait, after a document's last attempt settled, before trying it again: 30 s, 1 min,
 * 2 min … capped at 30 min. `attempts` is the number already made (at least 1). Deterministic, so
 * every worker agrees on when a document is due.
 */
export function retryDelayMs(attempts: number): number {
  const n = Number.isSafeInteger(attempts) && attempts > 1 ? attempts - 1 : 0;
  return Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** Math.min(n, 30));
}

/** Has the document used every attempt it is allowed? Then a person takes it. */
export function attemptsExhausted(attempts: number): boolean {
  return attempts >= MAX_SEND_ATTEMPTS;
}
