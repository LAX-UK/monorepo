import { Skeleton } from "@auction/ui/components/skeleton";

const KPI_KEYS = ["kpi-0", "kpi-1", "kpi-2", "kpi-3", "kpi-4", "kpi-5"] as const;
const TAB_KEYS = ["overview", "images", "documents", "bids"] as const;

/** Loading placeholder aligned with lot detail layout (header, meta row, KPI strip, tabs). */
export function AdminLotDetailSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-6 md:space-y-8"
      aria-busy="true"
      aria-label="Loading lot detail"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-2/3 max-w-lg" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {KPI_KEYS.map((id) => (
          <Skeleton key={id} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <div className="flex gap-2 overflow-hidden border-b border-border-hairline pb-2">
        {TAB_KEYS.map((id) => (
          <Skeleton key={id} className="h-9 w-24 shrink-0" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}
