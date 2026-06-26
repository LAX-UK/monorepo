import { INVOICE_PAYMENT_DUE_DAYS } from "@auction/types";

export { INVOICE_PAYMENT_DUE_DAYS };

/** Human-readable payment due date from invoice (payment row) creation time. */
export function formatPaymentDueDateFromCreated(createdAt: Date): string {
  const due = new Date(createdAt);
  due.setUTCDate(due.getUTCDate() + INVOICE_PAYMENT_DUE_DAYS);
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(due);
}
