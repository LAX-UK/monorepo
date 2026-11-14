/** Hourly: a hold ends on a date, so an hour's wait is well inside the request's due date. */
export const HELD_ERASURE_RECHECK_INTERVAL_MS = 60 * 60_000;

/**
 * Re-runs held data request erasures on every API instance, on the same in-process pattern as the
 * SSF replay retention. Runs on one instance never overlap; runs on several are kept apart by the
 * claim each request takes.
 */
export function startHeldErasureRecheckSchedule(options: {
  recheck: { run(): Promise<unknown> };
  onError: (error: unknown) => void;
  intervalMs?: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = options.recheck
      .run()
      .then(() => undefined)
      .catch(options.onError)
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(run, options.intervalMs ?? HELD_ERASURE_RECHECK_INTERVAL_MS);
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
