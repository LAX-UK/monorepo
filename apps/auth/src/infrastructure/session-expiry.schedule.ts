import type { SessionExpirySweep } from "../services/session-expiry-sweep.service.js";

export const SESSION_EXPIRY_INTERVAL_MS = 60_000;
/** Batches one run may take before yielding to the next, so a large backlog cannot hold the loop. */
export const SESSION_EXPIRY_MAX_BATCHES_PER_RUN = 20;

/**
 * Ends expired sign-in records every minute, and once at start-up. Runs never overlap, and `stop`
 * waits for the one in flight.
 */
export function startSessionExpirySchedule(options: {
  sweep: Pick<SessionExpirySweep, "run"> & { readonly batchSize: number };
  onError: (error: unknown) => void;
  onSwept?: (count: number) => void;
  intervalMs?: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const sweepBacklog = async () => {
    let total = 0;
    for (let batch = 0; batch < SESSION_EXPIRY_MAX_BATCHES_PER_RUN && !stopped; batch++) {
      const count = await options.sweep.run();
      total += count;
      if (count < options.sweep.batchSize) break;
    }
    if (total > 0) options.onSwept?.(total);
  };
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = sweepBacklog()
      .catch(options.onError)
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
