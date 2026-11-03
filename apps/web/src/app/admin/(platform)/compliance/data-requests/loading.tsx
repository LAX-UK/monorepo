import { ListPageSkeleton } from "@auction/staff-ui";

export default function DataRequestsLoading() {
  return (
    <ListPageSkeleton
      title="Data requests"
      description="Requests for a copy of a person's data, from the download and logged by staff. Each must be answered by its due date."
      columns={["Person", "Kind", "Products", "Requested", "Due", "Status", "Products done"]}
    />
  );
}
