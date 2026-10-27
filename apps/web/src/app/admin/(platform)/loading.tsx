import { ListPageSkeleton } from "@auction/staff-ui";

export default function AdminLoading() {
  return <ListPageSkeleton title="Loading…" columns={["Name", "Status", "Updated"]} />;
}
