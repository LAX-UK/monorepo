import { ListPageSkeleton } from "@auction/staff-ui";

export default function PaymentsLoading() {
  return (
    <ListPageSkeleton
      title="Payments"
      description="Buyer payments for won lots. Capture held payments, refund captured ones and check their Xero invoices."
      metrics={4}
      columns={["Lot", "Status", "Buyer", "Amount", "Fulfilment", "Created"]}
    />
  );
}
