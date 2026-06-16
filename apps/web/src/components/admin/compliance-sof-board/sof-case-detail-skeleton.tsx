import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { buildSofListHref } from "@/lib/admin/sof-list-query";
import { Skeleton } from "@auction/ui/components/skeleton";

function ContextRailSkeleton() {
  return (
    <div
      className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5"
      aria-busy="true"
      aria-label="Loading context"
    >
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <Skeleton className="h-24 w-full rounded-md" />
    </div>
  );
}

function MainColumnSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading case detail">
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}

export function SofCaseDetailSkeleton() {
  return (
    <AdminEntityDetailShell
      detailHeader
      detailHeaderSticky={false}
      backHref={buildSofListHref("pending")}
      backLabel="Source of Funds"
      eyebrow="Compliance review"
      title={<Skeleton className="h-8 w-64 max-w-full" />}
      description="Loading case…"
      meta={<Skeleton className="h-6 w-32 rounded-full" />}
      rail={<ContextRailSkeleton />}
      railSticky={false}
    >
      <MainColumnSkeleton />
    </AdminEntityDetailShell>
  );
}
