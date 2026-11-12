/**
 * What the re-offer sweep does with the answer of `ensureForLot` for a re-awarded lot whose invoice
 * was missed. Pure: the sweep asks here and records only what the answer says.
 *
 * - `raised`: the invoice went out. The only progress.
 * - `terminal`: the answer means an invoice already exists or the award is gone, so another attempt
 *   can never raise one. The sweep reports it once and marks the offer for good.
 * - `retry`: the invoice is owed but something someone can fix stands in the way (the seller's
 *   account, the payment limit, the amount), or the answer is one we do not know. The sweep reports
 *   it and marks the offer with a back-off, so the row is listed again a day later and the invoice
 *   is raised as soon as the data is fixed. An unknown answer is never terminal: listing a row
 *   again costs one warning a day, never raising an owed invoice costs the sale.
 */

export const INVOICE_NOT_RAISED_PREFIX = "invoice_not_raised:";
/** Marker prefix of an offer the sweep should try again once the back-off has passed. */
export const INVOICE_RETRY_PREFIX = `${INVOICE_NOT_RAISED_PREFIX}retry:`;
/** How long an offer marked for retry is left alone before the sweep lists it again. */
export const INVOICE_RETRY_BACKOFF_MS = 24 * 60 * 60 * 1000;

/**
 * Answers that mean an invoice can never be raised for this award: one already stands (or was
 * refunded), or the award itself has gone. Everything else is retried.
 */
export const TERMINAL_INVOICE_REASONS = [
  "payment_already_exists",
  "already_refunded",
  "lot_moved",
  "no_winner",
  "lot_not_found",
  "lot_not_ended",
  "missing_buyer_legal_entity",
] as const;

/**
 * Answers someone can fix, after which the invoice must be raised. Listed so the split is explicit;
 * any answer in neither list is retried too.
 */
export const RECOVERABLE_INVOICE_REASONS = [
  "missing_seller_legal_entity",
  "payment_amount_exceeds_limit",
  "invalid_payment_amount",
  "unchanged",
] as const;

/** `close_reason` is capped at 1000 characters by the table. */
const MARKER_MAX = 1000;

const TERMINAL = new Set<string>(TERMINAL_INVOICE_REASONS);

export type InvoiceAttempt = { created: boolean; reason?: string | undefined };

export type InvoiceSweepOutcome =
  | { kind: "raised" }
  | { kind: "terminal"; reason: string; marker: string }
  | { kind: "retry"; reason: string; marker: string };

export function isTerminalInvoiceReason(reason: string): boolean {
  return TERMINAL.has(reason);
}

export function invoiceSweepOutcome(attempt: InvoiceAttempt): InvoiceSweepOutcome {
  if (attempt.created) return { kind: "raised" };
  const reason = attempt.reason?.trim() || "unchanged";
  if (isTerminalInvoiceReason(reason)) {
    return { kind: "terminal", reason, marker: `${INVOICE_NOT_RAISED_PREFIX}${reason}` };
  }
  return {
    kind: "retry",
    reason,
    marker: `${INVOICE_RETRY_PREFIX}${reason}`.slice(0, MARKER_MAX),
  };
}
