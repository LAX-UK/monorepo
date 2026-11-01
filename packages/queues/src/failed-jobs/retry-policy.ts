import { failedJobTypeInfo } from "./job-types.js";

export type RetryAvailability = { allowed: true } | { allowed: false; reason: string };

export const ACTIONS_SWITCHED_OFF_REASON =
  "Retries and discards are switched off while an incident is handled. Ask engineering to switch them back on.";

/**
 * Whether a failed job can be retried from the dashboard. Two things say no: the kill switch an
 * operator sets during an incident, and a job type whose repeat is never safe to trigger by hand.
 */
export function retryAvailability(
  queue: string,
  context: { actionsEnabled: boolean },
): RetryAvailability {
  if (!context.actionsEnabled) return { allowed: false, reason: ACTIONS_SWITCHED_OFF_REASON };
  const blocked = failedJobTypeInfo(queue).retryBlockedReason;
  return blocked ? { allowed: false, reason: blocked } : { allowed: true };
}
