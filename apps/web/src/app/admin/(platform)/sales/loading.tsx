import { ListPageSkeleton } from "@auction/staff-ui";

export default function AdminSalesLoading() {
  return (
    <ListPageSkeleton
      title="Sales"
      columns={["Sale", "Status", "Format", "Lots", "Opens"]}
      metrics={4}
    />
  );
}
