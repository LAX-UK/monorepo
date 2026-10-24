import { ListPageSkeleton } from "@auction/staff-ui";

export default function DisputesLoading() {
  return (
    <ListPageSkeleton
      title="Disputes"
      description="Card disputes raised through Stripe. Open one for the payment, the evidence deadline and its history."
      metrics={4}
      columns={["Lot", "Status", "Reason", "Amount", "Seller", "Opened"]}
    />
  );
}
