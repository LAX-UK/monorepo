import { londonCalendarDate } from "@auction/identity-contracts";
import type { DataRequestWriter } from "../services/data-request.ports.js";

export const DATA_REQUEST_RETENTION_INTERVAL_MS = 60 * 60_000;
export const DATA_REQUEST_RETENTION_BATCH_SIZE = 200;

const DAY_MS = 86_400_000;

/**
 * Clears the contact name and details of manual data requests a set number of days after they
 * closed. The dates, scope, outcome and audit trail stay, as proof the request was answered. The
 * period is configuration, not a rule of the code: two years is a working figure, lawyer to confirm.
 * Returns the references that were cleared.
 */
export async function clearExpiredRequestContacts(
  writer: Pick<DataRequestWriter, "clearContacts">,
  retentionDays: number,
  now: Date,
): Promise<string[]> {
  const cutoff = londonCalendarDate(new Date(now.getTime() - retentionDays * DAY_MS));
  return writer.clearContacts(cutoff, now, DATA_REQUEST_RETENTION_BATCH_SIZE);
}

export function startDataRequestRetentionSchedule(options: {
  writer: Pick<DataRequestWriter, "clearContacts">;
  retentionDays: number;
  onError: (error: unknown) => void;
  onCleared: (count: number) => void;
  intervalMs?: number;
  now?: () => Date;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = clearExpiredRequestContacts(
      options.writer,
      options.retentionDays,
      (options.now ?? (() => new Date()))(),
    )
      .then((cleared) => {
        if (cleared.length > 0) options.onCleared(cleared.length);
      })
      .catch(options.onError)
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(run, options.intervalMs ?? DATA_REQUEST_RETENTION_INTERVAL_MS);
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
