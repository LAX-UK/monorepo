import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { buildSofListHref } from "@/lib/admin/sof-list-query";
import { Skeleton } from "@auction/ui/components/skeleton";

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
      backHref={buildSofListHref("pending")}
      backLabel="Source of Funds"
      eyebrow="Compliance review"
      title={<Skeleton className="h-8 w-64 max-w-full" />}
      description="Loading case…"
      meta={<Skeleton className="h-6 w-32 rounded-full" />}
    >
      <MainColumnSkeleton />
    </AdminEntityDetailShell>
  );
}
