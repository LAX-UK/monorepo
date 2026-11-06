import { invoiceDueAt } from "@auction/domain";
import type { IBidInvoiceDueDateRepository } from "@auction/persistence/interfaces";

/**
 * Moves an invoice's due date when a hold that kept the buyer from paying is released, so the
 * term runs from the release and not from the day the invoice was raised ("your due date moves
 * with it"). The new date is the term counted from the release, and the due date never moves
 * earlier: an invoice already due later keeps its date.
 */
export class InvoiceDueDateExtender {
  constructor(private readonly invoices: Pick<IBidInvoiceDueDateRepository, "extendDueAt">) {}

  /** Returns whether the due date moved. */
  extendAfterHold(invoiceId: string, releasedAt: Date): Promise<boolean> {
    return this.invoices.extendDueAt(invoiceId, invoiceDueAt(releasedAt));
  }
}
