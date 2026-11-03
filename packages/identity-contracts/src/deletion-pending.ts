import { ACCOUNT_DELETION_GRACE_DAYS } from "./deletion-eligibility.js";

/**
 * A person who has asked to delete their account may not take on anything new while the request
 * stands: a bid, a registration, a checkout or a payout. Every product refuses with this code and
 * message, so the person is told the same thing wherever they are stopped.
 */
export const ACCOUNT_DELETION_PENDING_CODE = "account_deletion_pending";

const DAY_MS = 24 * 60 * 60 * 1000;

const LONDON_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "long",
});

/** When the personal data is erased: the end of the grace period that began at `requestedAt`. */
export function accountDeletionDueAt(requestedAt: Date | string): Date {
  return new Date(new Date(requestedAt).getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS);
}

/** "2 December": the calendar day in London, which is how the person reads the date. */
export function formatDeletionDay(date: Date): string {
  return LONDON_DAY.format(date);
}

/** What a product tells a person it has stopped, in one sentence they can act on. */
export function accountDeletionPendingMessage(requestedAt: Date | string): string {
  const due = formatDeletionDay(accountDeletionDueAt(requestedAt));
  return `Your account is due to be deleted on ${due}. Cancel deletion to continue.`;
}

/** The body products return with a 403 when they stop a commitment. */
export function accountDeletionPendingBody(requestedAt: Date | string): {
  error: string;
  code: typeof ACCOUNT_DELETION_PENDING_CODE;
  /** The day, written for a reader, for screens that phrase the refusal themselves. */
  details: { dueOn: string };
  deletionDueAt: string;
} {
  const due = accountDeletionDueAt(requestedAt);
  return {
    error: accountDeletionPendingMessage(requestedAt),
    code: ACCOUNT_DELETION_PENDING_CODE,
    details: { dueOn: formatDeletionDay(due) },
    deletionDueAt: due.toISOString(),
  };
}
