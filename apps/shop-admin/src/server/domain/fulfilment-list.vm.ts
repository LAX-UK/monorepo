import type { AdminFulfilmentList } from "@auction/shop-contracts";

export type FulfilmentRow = AdminFulfilmentList["items"][number];

/** Where an order's fulfilment page is: the Fulfilment section on the order. */
export function fulfilmentOrderHref(orderId: string): string {
  return `/orders/${orderId}#fulfilment`;
}

/** Carrier and tracking number as one line; null when nothing has been recorded. */
export function fulfilmentTrackingLabel(
  row: Pick<FulfilmentRow, "carrier" | "trackingNumber">,
): string | null {
  if (!row.trackingNumber) return null;
  return `${row.carrier ?? "Carrier"} ${row.trackingNumber}`;
}
