import type { BidInvoiceRecord, IBidInvoiceReader } from "@auction/persistence/interfaces";
import type { InvoiceLine } from "@auction/types";

/** Stripe Checkout accepts at most 100 line items in one session. */
export const STRIPE_MAX_LINE_ITEMS = 100;

/** The stored invoice cannot back a charge, so no checkout is opened. */
export class InvoiceLinesError extends Error {
  constructor(
    readonly code: "invoice_missing" | "invoice_mismatch" | "too_many_lines",
    message: string,
  ) {
    super(message);
    this.name = "InvoiceLinesError";
  }
}

/** A stored invoice's lines, checked against the amount that is about to be charged for it. */
export type CheckedInvoiceLines = { invoiceId: string; lines: InvoiceLine[]; totalPence: number };

/**
 * The invoice's lines, provided they add up to the invoice total and the invoice total is the
 * amount charged. Anything else throws: money is never taken on figures that disagree.
 */
export function checkInvoiceLines(
  invoice: BidInvoiceRecord | undefined,
  paymentId: string,
  paymentAmountPence: number,
): CheckedInvoiceLines {
  if (!invoice) {
    throw new InvoiceLinesError("invoice_missing", `Payment ${paymentId} has no stored invoice`);
  }
  const sum = invoice.lines.reduce((total, line) => total + line.amountPence, 0);
  if (invoice.lines.length === 0 || sum !== invoice.totalPence) {
    throw new InvoiceLinesError(
      "invoice_mismatch",
      `Invoice ${invoice.id} lines add up to ${sum} pence, not its total of ${invoice.totalPence}`,
    );
  }
  if (invoice.totalPence !== paymentAmountPence) {
    throw new InvoiceLinesError(
      "invoice_mismatch",
      `Invoice ${invoice.id} totals ${invoice.totalPence} pence but payment ${paymentId} is ${paymentAmountPence}`,
    );
  }
  return { invoiceId: invoice.id, lines: invoice.lines, totalPence: invoice.totalPence };
}

/** Reads and checks the stored lines of each payment, in one query. */
export async function loadCheckedInvoiceLines(
  reader: Pick<IBidInvoiceReader, "findByPaymentIds">,
  payments: readonly { paymentId: string; amountPence: number }[],
): Promise<Map<string, CheckedInvoiceLines>> {
  const invoices = await reader.findByPaymentIds(payments.map((p) => p.paymentId));
  return new Map(
    payments.map((p) => [
      p.paymentId,
      checkInvoiceLines(invoices.get(p.paymentId), p.paymentId, p.amountPence),
    ]),
  );
}

export function assertWithinStripeLineLimit(lineCount: number): void {
  if (lineCount > STRIPE_MAX_LINE_ITEMS) {
    throw new InvoiceLinesError(
      "too_many_lines",
      `${lineCount} lines is more than one Stripe checkout can carry`,
    );
  }
}
