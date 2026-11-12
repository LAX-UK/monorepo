/**
 * What the re-offer sweep does with the answer of `ensureForLot` for a re-awarded lot whose invoice
 * was missed. Pure: the sweep asks here and records only what the answer says.
 *
 * Only `raised` is progress. Every other answer means the invoice was not raised and another
 * attempt would get the same answer (a deleted lot, a missing account, an amount over the limit, a
 * payment that already exists, a lot that moved on), so it is terminal: the sweep counts it, logs
 * it, warns, and marks the offer so the same row is not listed every run.
 */

export const INVOICE_NOT_RAISED_PREFIX = "invoice_not_raised:";

/** `close_reason` is capped at 1000 characters by the table. */
const MARKER_MAX = 1000;

export type InvoiceAttempt = { created: boolean; reason?: string | undefined };

export type InvoiceSweepOutcome =
  | { kind: "raised" }
  | { kind: "terminal"; reason: string; marker: string };

export function invoiceSweepOutcome(attempt: InvoiceAttempt): InvoiceSweepOutcome {
  if (attempt.created) return { kind: "raised" };
  const reason = attempt.reason?.trim() || "unchanged";
  return {
    kind: "terminal",
    reason,
    marker: `${INVOICE_NOT_RAISED_PREFIX}${reason}`.slice(0, MARKER_MAX),
  };
}
