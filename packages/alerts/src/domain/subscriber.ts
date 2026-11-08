import type { AlertProduct } from "./products.js";

export type SubscriberStatus = "pending" | "confirmed" | "stopped";

/** Why a subscriber stopped. A complaint ends every topic and is never undone by a settings switch. */
export const STOP_REASONS = [
  "link",
  "one_click",
  "settings",
  "complaint",
  "staff",
  "erasure",
] as const;
export type StopReason = (typeof STOP_REASONS)[number];

export type TopicChangedBy = "person" | "migration" | "staff";

/** A confirmation link works for this long after it was requested. */
export const CONFIRM_LINK_TTL_MS = 48 * 60 * 60 * 1000;

/** A second request for the same pending address sends no new email inside this time. */
export const CONFIRM_RESEND_INTERVAL_MS = 10 * 60 * 1000;

export function normaliseAlertEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** What every store returns about a subscriber: only what the rules need. */
export type SubscriberRecord = {
  id: string;
  product: AlertProduct;
  email: string;
  /** The account the address belongs to once linked: a Bid user id, or a Shop identity subject. */
  subjectId: string | null;
  status: SubscriberStatus;
  /** Why it stopped, once it has; a complaint is never undone by a settings switch. */
  stopReason?: StopReason | null;
  requestedAt: Date;
  confirmationSentAt: Date | null;
  /** Bumped to revoke every link already sent. */
  linkVersion: number;
};

export type SignupState = Pick<SubscriberRecord, "status" | "confirmationSentAt"> | null;

/**
 * Whether a sign-up request sends a confirmation email. A confirmed address is never mailed again,
 * a stopped one starts over (it must consent again), and a pending one is mailed again only after
 * a pause, so the form cannot be used to flood an inbox.
 */
export function shouldSendConfirmation(existing: SignupState, now: Date): boolean {
  if (!existing) return true;
  if (existing.status === "confirmed") return false;
  if (existing.status === "stopped") return true;
  if (!existing.confirmationSentAt) return true;
  return now.getTime() - existing.confirmationSentAt.getTime() >= CONFIRM_RESEND_INTERVAL_MS;
}

export type ConfirmationOutcome = "confirmed" | "already_confirmed" | "expired" | "invalid";

/**
 * What following a confirmation link does. `requestedAtMs` is the instant the link names, so a
 * link from an earlier request (replaced by a newer email, or from before a stop) is invalid.
 */
export function evaluateConfirmation(
  row: Pick<SubscriberRecord, "status" | "requestedAt"> | null,
  requestedAtMs: number,
  now: Date,
): ConfirmationOutcome {
  if (!row || row.requestedAt.getTime() !== requestedAtMs) return "invalid";
  if (row.status === "confirmed") return "already_confirmed";
  if (row.status === "stopped") return "invalid";
  return now.getTime() - requestedAtMs > CONFIRM_LINK_TTL_MS ? "expired" : "confirmed";
}

export type SubscriberEvent =
  | { type: "request" }
  | { type: "confirm" }
  | { type: "account_on" }
  | { type: "stop"; reason: StopReason };

/**
 * The state machine in one place. `null` is an address nobody has asked about yet. A request on a
 * confirmed address changes nothing; a confirmation only moves a pending one; a stop moves any
 * address that is not already stopped; a verified account switching alerts on is confirmed at once.
 */
export function nextStatus(
  current: SubscriberStatus | null,
  event: SubscriberEvent,
): SubscriberStatus | null {
  switch (event.type) {
    case "request":
      return current === "confirmed" ? "confirmed" : "pending";
    case "confirm":
      return current === "pending" ? "confirmed" : null;
    case "account_on":
      return "confirmed";
    case "stop":
      return current === null ? null : "stopped";
  }
}

/** Only a confirmed address receives alerts. */
export function receivesAlerts(status: SubscriberStatus): boolean {
  return status === "confirmed";
}

/** "a•••@example.com": enough to recognise the address, not enough to read it out. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${email.slice(0, 1)}•••${email.slice(at)}`;
}
