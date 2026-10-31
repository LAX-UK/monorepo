import type { AdminOrderDetail } from "@auction/shop-contracts";

/**
 * The name and address kept on an erased guest's order are for invoices only: staff who do not
 * handle invoices get the order without them.
 */
export function withRetainedInvoiceAccess(
  detail: AdminOrderDetail,
  canReadRetainedInvoiceData: boolean,
): AdminOrderDetail {
  if (canReadRetainedInvoiceData || !detail.retainedInvoiceContact) return detail;
  return { ...detail, retainedInvoiceContact: null };
}
