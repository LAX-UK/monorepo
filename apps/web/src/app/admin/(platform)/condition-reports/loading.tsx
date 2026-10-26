import { ListPageSkeleton } from "@auction/staff-ui";

export default function AdminConditionReportsLoading() {
  return (
    <ListPageSkeleton
      title="Condition report requests"
      columns={["Lot", "Requested by", "Status", "Requested"]}
      metrics={3}
    />
  );
}
