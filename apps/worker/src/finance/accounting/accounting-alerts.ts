import {
  type AlertCapture,
  type AlertLog,
  type AlertSink,
  createAlertSink,
} from "../../lib/alert-sink.js";

/**
 * The accounting alerts, one message each. A message here is logged at its level and sent to
 * Sentry, where the alert rules match on it; nothing else from the accounting runtime pages anyone.
 */
export const ACCOUNTING_ALERTS = {
  /** A document has waited for a person (Needs a person) for more than one working day. */
  needsPersonOverdue: { message: "accounting_needs_person_overdue", level: "warning" },
  /**
   * Delayed accounting. A buyer's Bid invoice has been "being prepared" for more than 30 minutes
   * (queued for Books, not yet issued with LAX's copy stored); the buyer's card says the team has
   * been told: this is it. Also raised, with `documentType: "payment"`, for payments that have
   * waited more than six hours for their invoice to reach Books.
   */
  bidInvoiceDelayed: { message: "accounting_bid_invoice_delayed", level: "warning" },
  /**
   * Shop invoices issued live are waiting for their "Your invoice" email and none can be sent:
   * SHOP_STOREFRONT_URL is unset, not https, or local. Raised every tick while any waits.
   */
  shopInvoiceEmailRefused: { message: "accounting_shop_invoice_email_refused", level: "error" },
  /**
   * Delayed accounting, Shop: an outside-UK delivery invoice was issued more than six hours ago
   * and the order payment's unapplied rest has still not been applied to it (no `apply_remainder`
   * in its history): the buyer's credit sits unapplied in Books.
   */
  shopRemainderDelayed: { message: "accounting_shop_remainder_delayed", level: "warning" },
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
   * A Books notice (webhook) arrived with a signature that does not verify. The Bid API's notice
   * route sends it to Sentry under this message, as a warning grouped into one issue, when it
   * refuses one (a missing signature is only logged); the alert rule pages on a rate of them, not
   * on each. It is listed here so the alert rules have one home.
   */
  noticeSignatureFailed: { message: "zoho_books.notice_signature_failed", level: "warning" },
  /**
   * The nightly Books status check has not finished a run for more than 26 hours while Books is
   * aimed at (the accounting watch raises it; its cron monitor `accounting-reconcile` also misses).
   */
  statusCheckMissed: { message: "accounting_status_check_missed", level: "error" },
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
  /** The nightly Books status check; its job checks in under this key. */
  reconcile: "accounting-reconcile",
} as const;

/** Where an alert goes. */
export type AccountingAlertSink = AlertSink<AccountingAlert>;

export type AccountingAlertLog = AlertLog;

/** Logs the alert and sends it to Sentry, where the alert rule for its message pages the team. */
export function createAccountingAlertSink(
  log: AccountingAlertLog,
  capture?: AlertCapture,
): AccountingAlertSink {
  return createAlertSink<AccountingAlert>(log, capture);
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
