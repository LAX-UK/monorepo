import { ListPageSkeleton } from "@auction/staff-ui";

export default function PurchaseProblemsLoading() {
  return (
    <ListPageSkeleton
      title="Purchase problems"
      description="Problems buyers report with a paid purchase. Take one on, put it right, and tell the buyer what was done."
      columns={["Reference", "Buyer", "Lot", "Reason", "Raised", "Owner", "Status"]}
    />
  );
}
