import { LONDON_TIME_ZONE, formatWhen } from "@auction/datetime";
import { type TemplateVarsByName, formatMoneyMajor } from "@auction/email";
import type { BidInvoiceEmailFacts } from "@auction/persistence/interfaces";

export type BidInvoiceEmailVars = TemplateVarsByName["bid-invoice-issued"];

/** A name for the attachment that is safe in a mail header: letters, digits and dashes. */
export function invoicePdfFilename(number: string): string {
  const safe = number.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "invoice";
  return `invoice-${safe}.pdf`;
}

/**
 * The "Your invoice" email for one issued Bid invoice: the Books number, the lot, the invoice's
 * stored total (never worked out again), and when it was paid or is due, in the shared moment
 * style ("Thu 12 Nov, 14:05 GMT", London). Pure; the caller reads the facts and the time.
 */
export function composeBidInvoiceEmail(input: {
  readonly number: string;
  readonly facts: BidInvoiceEmailFacts;
  readonly storageKey: string;
  readonly purchaseUrl: string;
  readonly userName: string | null;
  readonly now: Date;
}): BidInvoiceEmailVars {
  const { facts, now } = input;
  const total = formatMoneyMajor((facts.totalPence / 100).toFixed(2), "GBP");
  if (total === null) throw new Error("bid_invoice_email_bad_total");
  return {
    userName: input.userName,
    invoiceNumber: input.number,
    lotTitle: facts.lotTitle,
    total,
    settlement: facts.paidAt
      ? { kind: "paid", on: formatWhen(facts.paidAt, LONDON_TIME_ZONE, now) }
      : { kind: "due", by: formatWhen(facts.dueAt, LONDON_TIME_ZONE, now) },
    storedAttachment: {
      storageKey: input.storageKey,
      filename: invoicePdfFilename(input.number),
      contentType: "application/pdf",
    },
    purchaseUrl: input.purchaseUrl,
  };
}
