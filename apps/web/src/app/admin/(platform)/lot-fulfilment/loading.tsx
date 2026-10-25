import { ListPageSkeleton } from "@auction/staff-ui";

export default function LotFulfilmentLoading() {
  return (
    <ListPageSkeleton
      title="Lot fulfilment"
      description="Sold lots from payment to the buyer: release, then ship or hand over for collection."
      columns={["Lot", "Step", "Method", "Last change"]}
    />
  );
}
