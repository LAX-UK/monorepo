import { LONDON_TIME_ZONE, formatDate } from "@auction/datetime";
import { INVOICE_PAYMENT_DUE_DAYS } from "@auction/types";

export { INVOICE_PAYMENT_DUE_DAYS };

/** The invoice's due date for emails ("12 November 2026"), on the London calendar. */
export function formatPaymentDueDate(dueAt: Date): string {
  return formatDate(dueAt, LONDON_TIME_ZONE, { month: "long" });
}
