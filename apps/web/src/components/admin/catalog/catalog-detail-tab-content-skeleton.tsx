import { Skeleton } from "@auction/ui/components/skeleton";

/** Lightweight placeholder for catalog detail tab body transitions. */
export function CatalogDetailTabContentSkeleton() {
  return (
    <div className="scroll-mt-24 space-y-4" aria-busy="true" aria-label="Loading tab content">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
