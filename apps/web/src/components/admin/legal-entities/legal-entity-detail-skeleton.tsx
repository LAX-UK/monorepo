import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { TabbedQueueSkeleton } from "@/components/admin/admin-loading-skeletons";
import { Skeleton } from "@auction/ui/components/skeleton";

/** Loading state aligned with legal entity detail shell + tabs. */
export function LegalEntityDetailSkeleton() {
  return (
    <AdminEntityDetailShell
      backHref="/admin/legal-entities"
      backLabel="Legal entities"
      title={<Skeleton className="h-8 w-64 max-w-full" />}
      description="Loading entity…"
      actions={<Skeleton className="h-9 w-16 rounded-md" />}
      meta={
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {["kpi-0", "kpi-1", "kpi-2"].map((id) => (
              <Skeleton key={id} className="h-14 w-full rounded-md" />
            ))}
          </div>
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
      }
    >
      <TabbedQueueSkeleton tabs={6} />
    </AdminEntityDetailShell>
  );
}
