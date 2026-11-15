import { Skeleton } from "@auction/staff-ui";

const FACTS = 5;

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-staff-line-subtle px-4 py-2.5">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-control-sm w-32 rounded-staff-sm" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: rows }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
          <div key={index} className="grid gap-1 @sm:grid-cols-[148px_minmax(0,1fr)] sm:gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The Storage tab while it loads: the notice, the In force and Charging cards side by side
 * (stacked on a phone) and the History table, at their real heights.
 */
export function StorageSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="h-16 w-full rounded-staff-lg" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <CardSkeleton rows={FACTS} />
        <CardSkeleton rows={2} />
      </div>
      <CardSkeleton rows={4} />
    </div>
  );
}
