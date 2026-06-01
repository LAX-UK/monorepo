import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { TabbedQueueSkeleton } from "@/components/admin/admin-loading-skeletons";
import { Skeleton } from "@auction/ui/components/skeleton";

function ContextRailSkeleton() {
  return (
    <div
      className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5"
      aria-busy="true"
      aria-label="Loading context"
    >
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-8 w-28 rounded-full" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    </div>
  );
}

/** Loading state aligned with legal entity detail shell + tabs. */
export function LegalEntityDetailSkeleton() {
  return (
    <AdminEntityDetailShell
      detailHeader
      detailHeaderSticky={false}
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
      rail={<ContextRailSkeleton />}
      railSticky={false}
    >
      <TabbedQueueSkeleton tabs={3} />
    </AdminEntityDetailShell>
  );
}
