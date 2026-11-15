import { ListPageSkeleton } from "@auction/staff-ui";

export default function CollectionsLoading() {
  return (
    <ListPageSkeleton
      title="Collections"
      description="Who is coming to collect, and when. Hand over after checking photo ID."
      columns={["Buyer", "Collector", "Lots", "Work", "Booking"]}
    />
  );
}
