import { AdminListPage } from "@/components/admin/admin-list-page";
import { KanbanSkeleton } from "@/components/admin/admin-loading-skeletons";
import { Skeleton } from "@auction/ui/components/skeleton";

export default function ConveyorLoading() {
  return (
    <AdminListPage
      title="Conveyor"
      description="Loading pipeline…"
      hasFilters={false}
      resetHref="/admin/conveyor"
      view={<KanbanSkeleton columns={5} />}
      pagination={<Skeleton className="h-10 w-48" />}
    />
  );
}
