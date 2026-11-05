import { invoiceDueAt } from "@auction/domain";
import { INVOICE_PAYMENT_DUE_DAYS } from "@auction/types";

export { INVOICE_PAYMENT_DUE_DAYS };

/** The invoice's due date for emails ("12 November 2026"), on the London calendar. */
export function formatPaymentDueDateFromCreated(createdAt: Date): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(
    invoiceDueAt(createdAt),
  );
}
