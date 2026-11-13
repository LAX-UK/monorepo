import { Sentry } from "@auction/observability";

/**
 * The accounting alerts, one message each. A message here is logged at its level and sent to
 * Sentry, where the alert rules match on it; nothing else from the accounting runtime pages anyone.
 */
export const ACCOUNTING_ALERTS = {
  /** A document has waited for a person (Needs a person) for more than one working day. */
  needsPersonOverdue: { message: "accounting_needs_person_overdue", level: "warning" },
  /** Documents are queued for Books but the sender has not claimed any for too long. */
  senderMissed: { message: "accounting_sender_missed", level: "error" },
  /** The day's Books calls passed 80% of the budget (`BUDGET_WARNING_EVENT` in the Books client). */
  budgetPastWarning: { message: "zoho_books.budget_past_warning", level: "warning" },
  /**
   * The Books limiter stopped sending after repeated failures. The Books client has no circuit
   * yet (only the dry run is built); its live client logs this event when it opens.
   */
  circuitOpen: { message: "zoho_books.circuit_open", level: "error" },
  /**
   * A Books notice (webhook) arrived with a signature that does not verify. There is no Books
   * notice route yet; the route logs this event when it refuses one.
   */
  noticeSignatureFailed: { message: "zoho_books.notice_signature_failed", level: "error" },
} as const satisfies Record<string, { message: string; level: "warning" | "error" }>;

export type AccountingAlert = (typeof ACCOUNTING_ALERTS)[keyof typeof ACCOUNTING_ALERTS];

/**
 * The accounting crons, as Sentry cron monitors: each key maps to a monitor slug through
 * `SENTRY_MONITOR_SLUGS`, like every other worker cron, and a missed check-in is the alert.
 */
export const ACCOUNTING_CRON_MONITORS = {
  /** The watch below, every 15 minutes. */
  watch: "accounting-watch",
  /** The sender, which runs with the projectors; it checks in at most every 5 minutes. */
  sender: "accounting-sender",
  /** The nightly Books reconciliation, when it is added; its job checks in under this key. */
  reconcile: "accounting-reconcile",
} as const;

/** Where an alert goes. */
export interface AccountingAlertSink {
  raise(alert: AccountingAlert, details: Readonly<Record<string, unknown>>): void;
}

export interface AccountingAlertLog {
  warn(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
}

type Capture = (
  message: string,
  context: { level: "warning" | "error"; extra: Record<string, unknown> },
) => void;

/** Logs the alert and sends it to Sentry, where the alert rule for its message pages the team. */
export function createAccountingAlertSink(
  log: AccountingAlertLog,
  capture: Capture = (message, context) => {
    Sentry.captureMessage(message, context);
  },
): AccountingAlertSink {
  return {
    raise(alert, details) {
      const extra = { ...details };
      if (alert.level === "error") log.error(extra, alert.message);
      else log.warn(extra, alert.message);
      capture(alert.message, { level: alert.level, extra });
    },
  };
}

const ALERT_BY_EVENT = new Map<string, AccountingAlert>(
  [ACCOUNTING_ALERTS.budgetPastWarning, ACCOUNTING_ALERTS.circuitOpen].map((alert) => [
    alert.message,
    alert,
  ]),
);

type BooksLogLevel = "debug" | "info" | "warn" | "error";
type BooksLogger = {
  log(level: BooksLogLevel, event: string, fields: Readonly<Record<string, unknown>>): void;
};

/**
 * The Books client's logger with the alert hook: events the client logs that are alerts (the
 * budget past 80%, the limiter's circuit opening) are raised as well as logged. The live Books
 * client is built with this; the dry run makes no calls, so nothing raises them yet.
 */
export function booksLoggerWithAlerts(base: BooksLogger, alerts: AccountingAlertSink): BooksLogger {
  return {
    log(level, event, fields) {
      base.log(level, event, fields);
      const alert = ALERT_BY_EVENT.get(event);
      if (alert) alerts.raise(alert, fields);
    },
  };
}
