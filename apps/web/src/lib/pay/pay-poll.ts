import type { PayPlanProgress } from "@auction/types";

/** How often to ask the server whether a payment under way has moved, and for how long. */
export type PollPolicy = {
  /** The wait before each ask; the last wait repeats until the time is up (a backoff that levels off). */
  delaysMs: readonly number[];
  /** After this long the page stops asking and tells the person how to check. */
  maxElapsedMs: number;
};

/** A card payment is usually confirmed within a minute: ask often at first, then every 8 seconds. */
export const CONFIRMING_POLL: PollPolicy = {
  delaysMs: [2_000, 4_000, 8_000],
  maxElapsedMs: 180_000,
};

/** A bank transfer can take hours: ask slowly, and stop; the payer is emailed when it lands. */
export const TRANSFER_POLL: PollPolicy = {
  delaysMs: [15_000, 30_000, 60_000],
  maxElapsedMs: 900_000,
};

export function pollPolicyFor(stage: PayPlanProgress["stage"]): PollPolicy {
  return stage === "confirming" ? CONFIRMING_POLL : TRANSFER_POLL;
}

/**
 * The wait before the next ask, or `null` when the time is up. `attempt` counts the asks made so
 * far and `elapsedMs` is the time since the page began asking.
 */
export function nextPollDelay(
  policy: PollPolicy,
  attempt: number,
  elapsedMs: number,
): number | null {
  const last = policy.delaysMs.length - 1;
  const delay = policy.delaysMs[Math.min(attempt, last)];
  if (delay === undefined || elapsedMs + delay > policy.maxElapsedMs) return null;
  return delay;
}
