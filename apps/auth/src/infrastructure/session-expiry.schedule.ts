import type { SessionExpirySweep } from "../services/session-expiry-sweep.service.js";

export const SESSION_EXPIRY_INTERVAL_MS = 60_000;
/** Batches one run may take before yielding to the next, so a large backlog cannot hold the loop. */
export const SESSION_EXPIRY_MAX_BATCHES_PER_RUN = 20;
/** How long the sweep may fail or leave records behind before it is reported as stalled. */
export const SESSION_EXPIRY_STALL_ALERT_MS = 10 * 60_000;

/**
 * Ends expired sign-in records every minute, and once at start-up. Runs never overlap, and `stop`
 * waits for the one in flight.
 */
export function startSessionExpirySchedule(options: {
  sweep: Pick<SessionExpirySweep, "run"> & { readonly batchSize: number };
  onError: (error: unknown) => void;
  onSwept?: (count: number) => void;
  /**
   * Called when the sweep has been failing, or leaving records behind, for 10 minutes without a
   * clean run, and then at most once every 10 minutes while that lasts. Idle and absolute limits
   * rely on this job as well as on the issuer's own expiry, so a stalled sweep is an alert.
   */
  onStalled?: (stall: { since: Date; failed: boolean }) => void;
  /** Runs after each sweep, on its own: a failure is reported through `onError` and never stops the sweep. */
  afterSweep?: () => Promise<void>;
  intervalMs?: number;
  stallAlertMs?: number;
  now?: () => number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const clock = options.now ?? Date.now;
  const stallAlertMs = options.stallAlertMs ?? SESSION_EXPIRY_STALL_ALERT_MS;
  let unhealthySince: number | null = null;
  let lastStallAlertAt: number | null = null;
  /** A run is clean when it errored nowhere and ended on a short batch (nothing more to take). */
  const note = (clean: boolean, failed: boolean) => {
    if (clean) {
      unhealthySince = null;
      lastStallAlertAt = null;
      return;
    }
    const at = clock();
    unhealthySince ??= at;
    if (at - unhealthySince < stallAlertMs) return;
    if (lastStallAlertAt !== null && at - lastStallAlertAt < stallAlertMs) return;
    lastStallAlertAt = at;
    options.onStalled?.({ since: new Date(unhealthySince), failed });
  };
  const sweepBacklog = async () => {
    let total = 0;
    let drained = false;
    for (let batch = 0; batch < SESSION_EXPIRY_MAX_BATCHES_PER_RUN && !stopped; batch++) {
      const count = await options.sweep.run();
      total += count;
      if (count < options.sweep.batchSize) {
        drained = true;
        break;
      }
    }
    if (total > 0) options.onSwept?.(total);
    note(drained || stopped, false);
  };
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = sweepBacklog()
      .catch((error) => {
        options.onError(error);
        note(false, true);
      })
      .then(async () => {
        if (!stopped) await options.afterSweep?.().catch(options.onError);
      })
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(run, options.intervalMs ?? SESSION_EXPIRY_INTERVAL_MS);
  timer.unref();
  run();
  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await inFlight;
    },
  };
}
