import { ListPageSkeleton } from "@auction/staff-ui";

export default function AuditLogLoading() {
  return (
    <ListPageSkeleton
      title="Audit log"
      description="Who did what across the platform, and when. Open an event to see exactly what changed."
      columns={["Time", "Actor", "Action", "Record", "Summary"]}
    />
  );
}
