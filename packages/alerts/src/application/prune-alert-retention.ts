import { type AlertRetentionCutoffs, alertRetentionCutoffs } from "../domain/retention.js";

/** What one prune removed (or, in a dry run, would remove). Counts only; never an address. */
export type AlertPruneCounts = {
  /** Subscribers whose double opt-in was never confirmed. */
  unconfirmed: number;
  /** Stopped subscribers deleted with everything under them. */
  stopped: number;
  /** Complaint-stopped subscribers whose topics, matches and digests were removed; the row stays. */
  suppressionsTrimmed: number;
  /** Settled matches older than the log period. */
  matches: number;
  /** Sent digests older than the log period. */
  digests: number;
};

export type AlertRetentionStore = {
  /** A name for logs: `bid`, `shop`, `visitor_sale`. */
  readonly name: string;
  prune(cutoffs: AlertRetentionCutoffs, options: { dryRun: boolean }): Promise<AlertPruneCounts>;
};

type Logger = {
  info: (fields: Record<string, unknown>, message: string) => void;
  error: (fields: Record<string, unknown>, message: string) => void;
};

/**
 * Applies the retention rules to each store. A store that fails does not stop the others; the run
 * reports the failure afterwards so the scheduler retries. Safe to run again: pruned data is gone.
 */
export async function pruneAlertRetention(input: {
  stores: readonly AlertRetentionStore[];
  log: Logger;
  dryRun?: boolean;
  now?: Date;
}): Promise<{ dryRun: boolean; failed: number; counts: Record<string, AlertPruneCounts> }> {
  const dryRun = input.dryRun ?? false;
  const cutoffs = alertRetentionCutoffs(input.now ?? new Date());
  const counts: Record<string, AlertPruneCounts> = {};
  let failed = 0;
  for (const store of input.stores) {
    try {
      const result = await store.prune(cutoffs, { dryRun });
      counts[store.name] = result;
      input.log.info(
        { store: store.name, dryRun, ...result },
        dryRun ? "alert_retention_would_prune" : "alert_retention_pruned",
      );
    } catch (error) {
      failed += 1;
      input.log.error({ store: store.name, error }, "alert_retention_failed");
    }
  }
  if (failed > 0)
    throw new Error(`Alert retention prune failed for ${failed} store(s); will retry`);
  return { dryRun, failed, counts };
}
