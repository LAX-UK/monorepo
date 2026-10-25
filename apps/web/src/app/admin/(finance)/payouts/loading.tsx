import { ListPageSkeleton } from "@auction/staff-ui";

export default function PayoutsLoading() {
  return (
    <ListPageSkeleton
      title="Payouts"
      description="Seller payouts. Run settlement, add adjustments, mark transfers as paid and reverse payouts."
      metrics={4}
      columns={["Period", "Status", "Seller", "Net", "Paid"]}
    />
  );
}
