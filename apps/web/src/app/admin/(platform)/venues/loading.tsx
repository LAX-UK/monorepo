import { ListPageSkeleton } from "@auction/staff-ui";

export default function AdminVenuesLoading() {
  return (
    <ListPageSkeleton
      title="Venues"
      description="Reusable onsite gallery and branch locations. Only venues owned by the sale operator can be attached to a sale."
      columns={["Venue", "Organisation", "Address", "Status", "Updated"]}
    />
  );
}
