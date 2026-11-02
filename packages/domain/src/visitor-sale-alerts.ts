/**
 * New-sale email alerts for people without an account. The rules are here and nowhere else:
 * who is mailed a confirmation, when a confirmation link works, and what a link does to the list.
 */

export type VisitorAlertStatus = "pending" | "confirmed" | "unsubscribed";

/** The wording beside the sign-up form; stored with each request as proof of consent. */
export const VISITOR_ALERT_CONSENT_TEXT =
  "We'll email you when LAX Bid announces new sales. You can unsubscribe at any time.";

/** A confirmation link works for this long after it was requested. */
export const VISITOR_ALERT_CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;

/** A second request for the same pending address does not send another email inside this time. */
export const VISITOR_ALERT_RESEND_INTERVAL_MS = 10 * 60 * 1000;

export function normaliseAlertEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type VisitorAlertSignupState = {
  status: VisitorAlertStatus;
  confirmationSentAt: Date | null;
} | null;

/**
 * Whether a sign-up request sends a confirmation email. A confirmed address is never mailed
 * again, an unsubscribed one starts over (it must consent again), and a pending one is mailed
 * again only after a pause, so the form cannot be used to flood an inbox.
 */
export function shouldSendConfirmation(existing: VisitorAlertSignupState, now: Date): boolean {
  if (!existing) return true;
  if (existing.status === "confirmed") return false;
  if (existing.status === "unsubscribed") return true;
  if (!existing.confirmationSentAt) return true;
  return now.getTime() - existing.confirmationSentAt.getTime() >= VISITOR_ALERT_RESEND_INTERVAL_MS;
}

export type VisitorAlertConfirmation = "confirmed" | "already_confirmed" | "expired" | "invalid";

/**
 * What following a confirmation link does. `requestedAtMs` is the instant the link names; a link
 * from an earlier request (superseded by a newer email, or from before an unsubscribe) is invalid.
 */
export function evaluateConfirmation(
  row: { status: VisitorAlertStatus; requestedAt: Date } | null,
  requestedAtMs: number,
  now: Date,
): VisitorAlertConfirmation {
  if (!row || row.requestedAt.getTime() !== requestedAtMs) return "invalid";
  if (row.status === "confirmed") return "already_confirmed";
  if (row.status === "unsubscribed") return "invalid";
  return now.getTime() - requestedAtMs > VISITOR_ALERT_CONFIRM_TTL_MS ? "expired" : "confirmed";
}

/** Only a confirmed address receives alerts. */
export function receivesSaleAlerts(status: VisitorAlertStatus): boolean {
  return status === "confirmed";
}
