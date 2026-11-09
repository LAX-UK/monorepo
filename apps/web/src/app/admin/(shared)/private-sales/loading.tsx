import { ListPageSkeleton } from "@auction/staff-ui";

export default function PrivateSalesLoading() {
  return (
    <ListPageSkeleton
      title="Private sales"
      description="Works sold by private treaty, from offer to the seller's payout."
      columns={["Work", "Seller", "Buyer", "Price", "Stage", "Next date"]}
    />
  );
}
