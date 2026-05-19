import { Skeleton } from "@auction/ui/components/skeleton";

/** Loading placeholder aligned with admin detail chrome (header + tabs). */
export function AdminDetailSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading detail">
      <div className="-mx-4 space-y-3 border-b border-border-hairline px-4 pb-4 md:-mx-8 md:px-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-2/3 max-w-md" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden">
        {["Overview", "Details", "Activity"].map((label) => (
          <Skeleton key={label} className="h-9 w-24 shrink-0" />
        ))}
      </div>
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  );
}
