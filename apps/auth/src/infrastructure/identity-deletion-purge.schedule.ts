import { ACCOUNT_DELETION_GRACE_DAYS } from "@auction/identity-contracts";
import type {
  IdentityDeletionPurgeService,
  PurgeRunSummary,
} from "../services/identity-deletion-purge.service.js";

export const IDENTITY_DELETION_PURGE_INTERVAL_MS = 24 * 60 * 60_000;
/** The same number LAX Account tells people, so the promise and the purge cannot drift apart. */
export const IDENTITY_DELETION_GRACE_DAYS = ACCOUNT_DELETION_GRACE_DAYS;

/**
 * Runs the deletion purge once a day and once at start-up. Runs never overlap, and `stop`
 * waits for the one in flight.
 */
export function startIdentityDeletionPurgeSchedule(options: {
  service: Pick<IdentityDeletionPurgeService, "run">;
  onError: (error: unknown) => void;
  onRun?: (summary: PurgeRunSummary) => void;
  intervalMs?: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = options.service
      .run()
      .then((summary) => options.onRun?.(summary))
      .catch(options.onError)
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(run, options.intervalMs ?? IDENTITY_DELETION_PURGE_INTERVAL_MS);
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
