import { ORDER_STATUS_LABELS, orderStatusTone } from "@/server/domain/order-list.vm";
import { ADMIN_ORDER_STATUSES } from "@auction/shop-contracts";
import { StatusBadge } from "@auction/ui";

/** A status the API adds later still renders, as its raw name, rather than breaking the list. */
export function OrderStatusBadge({ status }: { status: string }) {
  const known = ADMIN_ORDER_STATUSES.find((candidate) => candidate === status);
  return (
    <StatusBadge variant={orderStatusTone(status)}>
      {known ? ORDER_STATUS_LABELS[known] : status}
    </StatusBadge>
  );
}
