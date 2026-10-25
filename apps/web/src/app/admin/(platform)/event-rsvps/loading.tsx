import { ListPageSkeleton } from "@auction/staff-ui";

export default function EventRsvpsLoading() {
  return (
    <ListPageSkeleton
      title="Event RSVPs"
      description="Guest lists, passes and door check-in for invitation-only events. Live bidding runs in Saleroom."
      columns={["Event", "Status", "RSVPs", "Starts"]}
    />
  );
}
