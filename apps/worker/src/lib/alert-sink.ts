import { Sentry } from "@auction/observability";

/** An alert the worker raises: a fixed message the Sentry alert rules match on, and its level. */
export type WorkerAlert = { readonly message: string; readonly level: "warning" | "error" };

/** Where an alert goes. */
export interface AlertSink<A extends WorkerAlert = WorkerAlert> {
  raise(alert: A, details: Readonly<Record<string, unknown>>): void;
}

export interface AlertLog {
  warn(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
}

export type AlertCapture = (
  message: string,
  context: { level: "warning" | "error"; extra: Record<string, unknown> },
) => void;

/** Logs the alert and sends it to Sentry, where the alert rule for its message pages the team. */
export function createAlertSink<A extends WorkerAlert = WorkerAlert>(
  log: AlertLog,
  capture: AlertCapture = (message, context) => {
    Sentry.captureMessage(message, context);
  },
): AlertSink<A> {
  return {
    raise(alert, details) {
      const extra = { ...details };
      if (alert.level === "error") log.error(extra, alert.message);
      else log.warn(extra, alert.message);
      capture(alert.message, { level: alert.level, extra });
    },
  };
}
