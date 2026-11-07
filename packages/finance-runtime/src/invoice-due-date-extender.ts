import type { Database } from "@auction/db";
import { invoiceDueAt } from "@auction/domain";
import type {
  IBidInvoiceDueDateRepository,
  OpenInvoiceScope,
} from "@auction/persistence/interfaces";

/**
 * Moves an invoice's due date when a hold that kept the buyer from paying is released, so the
 * term runs from the release and not from the day the invoice was raised ("your due date moves
 * with it"). The new date is the term counted from the release, and the due date never moves
 * earlier: an invoice already due later keeps its date.
 */
export class InvoiceDueDateExtender {
  constructor(
    private readonly invoices: Pick<
      IBidInvoiceDueDateRepository,
      "extendDueAt" | "extendUnpaidDueDates"
    >,
  ) {}

  /** Returns whether the due date moved. With `tx` it joins that transaction. */
  extendAfterHold(invoiceId: string, releasedAt: Date, tx?: Database): Promise<boolean> {
    return this.invoices.extendDueAt(invoiceId, invoiceDueAt(releasedAt), tx);
  }

  /**
   * Moves the due date of every unpaid invoice in `scope` when a hold on the buyer is released
   * (a source-of-funds case approved, an identity verified, an organisation approved): each
   * invoice that fell due during the hold gets the term counted from the release. One statement,
   * idempotent; an invoice already due later keeps its date, and one that was overdue before the
   * hold began (`scope.holdStartedAt`) is not touched. Returns how many due dates moved.
   */
  extendOpenInvoices(scope: OpenInvoiceScope, releasedAt: Date, tx?: Database): Promise<number> {
    return this.invoices.extendUnpaidDueDates(scope, invoiceDueAt(releasedAt), tx);
  }
}
