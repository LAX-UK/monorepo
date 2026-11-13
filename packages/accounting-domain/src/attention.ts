import { type DocumentRecord, requeue } from "./lifecycle.js";

/**
 * How staff see the document queue: what needs a person, what was refused, what is still on its
 * way, and what reached the books. Cancelled documents are in none of them.
 */
export const QUEUE_TABS = ["needs_person", "failed", "waiting", "issued"] as const;
export type QueueTab = (typeof QUEUE_TABS)[number];

export function isQueueTab(value: unknown): value is QueueTab {
  return typeof value === "string" && (QUEUE_TABS as readonly string[]).includes(value);
}

/**
 * Every adapter ends a refusal reason with this when the provider would not book the document
 * because its date falls in a period the books have locked (`zoho_books_validation_period_locked`).
 */
export const LOCKED_PERIOD_REASON_SUFFIX = "_period_locked";

/** Refused because the document's date is in a locked period: trying again alone cannot help. */
export function isLockedPeriodReason(reason: string | null | undefined): boolean {
  return typeof reason === "string" && reason.endsWith(LOCKED_PERIOD_REASON_SUFFIX);
}

/**
 * Which tab a record belongs in. A refusal for a locked period needs a person (someone must
 * confirm booking it on today's date), so it sits with the reviews rather than the failures.
 */
export function queueTabFor(record: DocumentRecord): QueueTab | null {
  switch (record.status) {
    case "needs_review":
      return "needs_person";
    case "failed":
      return isLockedPeriodReason(record.reason) ? "needs_person" : "failed";
    case "pending":
    case "sending":
    case "unknown":
      return "waiting";
    case "issued":
      return "issued";
    case "cancelled":
      return null;
  }
}

/**
 * Whether a person may send this same document again now: exactly when the life cycle would
 * requeue it (a refusal, or a review with nothing owed and nothing held by the provider).
 */
export function canTryAgain(record: DocumentRecord): boolean {
  return requeue(record).ok;
}
