import { AdminDetailSkeleton } from "@/components/admin/admin-loading-skeletons";
import { TableSkeleton } from "@auction/ui";

export default function RegistrationsLoading() {
  return (
    <div className="space-y-8">
      <AdminDetailSkeleton />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
