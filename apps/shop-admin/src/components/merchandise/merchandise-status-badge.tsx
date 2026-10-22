import type { MerchandiseStatus } from "@auction/shop-contracts";
import { StatusBadge } from "@auction/ui";

/** "On sale" rather than "Active", so the badge says what the shop is doing with the product. */
export function MerchandiseStatusBadge({ status }: { status: MerchandiseStatus }) {
  return status === "active" ? (
    <StatusBadge variant="success">On sale</StatusBadge>
  ) : (
    <StatusBadge variant="neutral">Archived</StatusBadge>
  );
}
