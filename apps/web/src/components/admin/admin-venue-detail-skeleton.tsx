import { Skeleton } from "@auction/ui/components/skeleton";

const TAB_KEYS = ["overview", "sales", "activity"] as const;

/** Loading placeholder aligned with venue detail layout. */
export function AdminVenueDetailSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-6 md:space-y-8"
      aria-busy="true"
      aria-label="Loading venue detail"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="space-y-3 border-b border-border-hairline pb-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-2/3 max-w-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden border-b border-border-hairline pb-2">
        {TAB_KEYS.map((id) => (
          <Skeleton key={id} className="h-9 w-24 shrink-0" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg sm:col-span-2" />
      </div>
    </div>
  );
}
