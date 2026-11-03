import type { SubjectExportService } from "../services/subject-export.service.js";

export const SUBJECT_EXPORT_MAINTENANCE_INTERVAL_MS = 15 * 60_000;

/**
 * The log line for each overdue tier. The wording is the contract the alert rules match on
 * (see ALERTING_LOG_MESSAGES): operations hears first, the data protection contact at seven
 * days, and the on-call page at 21 days, ten days inside the legal month.
 */
export const SUBJECT_EXPORT_DEADLINE_ALERTS = {
  1: { message: "subject_export_overdue_24h", level: "warn" },
  2: { message: "subject_export_overdue_7d", level: "error" },
  3: { message: "subject_export_overdue_21d", level: "error" },
} as const;

type AlertLog = {
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
};

/** One pass: expire finished copies, then raise any deadline alerts that are newly due. */
export async function runSubjectExportMaintenance(
  service: Pick<SubjectExportService, "expireDue" | "claimDeadlineAlerts">,
  log: AlertLog,
): Promise<{ expired: number; alerts: number }> {
  const expired = await service.expireDue();
  const alerts = await service.claimDeadlineAlerts();
  for (const { row, tier } of alerts) {
    const alert = SUBJECT_EXPORT_DEADLINE_ALERTS[tier as 1 | 2 | 3];
    if (!alert) continue;
    // Ids and dates only: the log never names the person.
    log[alert.level](
      {
        exportId: row.id,
        status: row.status,
        requestedAt: row.requestedAt.toISOString(),
        dueAt: row.dueAt.toISOString(),
        lastErrorCode: row.lastErrorCode,
      },
      alert.message,
    );
  }
  return { expired, alerts: alerts.length };
}

export function startSubjectExportMaintenanceSchedule(options: {
  service: Pick<SubjectExportService, "expireDue" | "claimDeadlineAlerts">;
  log: AlertLog;
  onError: (error: unknown) => void;
  intervalMs?: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = runSubjectExportMaintenance(options.service, options.log)
      .then(() => undefined)
      .catch(options.onError)
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(run, options.intervalMs ?? SUBJECT_EXPORT_MAINTENANCE_INTERVAL_MS);
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
