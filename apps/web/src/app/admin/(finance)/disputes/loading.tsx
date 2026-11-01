import { ListPageSkeleton } from "@auction/staff-ui";

export default function DisputesLoading() {
  return (
    <ListPageSkeleton
      title="Disputes"
      description="Card disputes on Bid payments. Allocate each one to the right invoices before the deadline."
      columns={["Dispute", "Allocation", "Respond by", "Buyer", "Amount", "Status"]}
    />
  );
}
