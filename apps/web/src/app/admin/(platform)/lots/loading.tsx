import { ListPageSkeleton } from "@auction/staff-ui";

export default function LotsLoading() {
  return (
    <ListPageSkeleton
      title="Lots"
      description="Publish, schedule and triage catalogue lots. Open a lot to see it beside the list."
      columns={["Lot", "Sale", "Status", "Estimate", "Hammer", "Ends"]}
    />
  );
}
