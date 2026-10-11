import { ART_ARTWORK_GRID_CLASS } from "@/components/catalogue/art-artwork-grid";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import { Skeleton } from "@auction/ui/components/skeleton";

function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-6 lg:py-10")} aria-busy="true">
      <output className="sr-only">{label}</output>
      {children}
    </div>
  );
}

export function ArtCardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={ART_ARTWORK_GRID_CLASS}>
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={index} className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ArtCatalogueSkeleton({ label = "Loading artworks" }: { label?: string }) {
  return (
    <LoadingRegion label={label}>
      <Skeleton className="mb-8 h-9 w-48" />
      <ArtCardGridSkeleton />
    </LoadingRegion>
  );
}

export function ArtDetailSkeleton() {
  return (
    <LoadingRegion label="Loading artwork">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Skeleton className="aspect-square w-full" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-11 w-40" />
        </div>
      </div>
    </LoadingRegion>
  );
}

export function ArtAccountSkeleton() {
  return (
    <LoadingRegion label="Loading account">
      <Skeleton className="mb-8 h-9 w-40" />
      <div className="grid gap-8 lg:grid-cols-[12rem_1fr]">
        <div className="flex gap-2 lg:flex-col">
          {Array.from({ length: 4 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
            <Skeleton key={index} className="h-11 w-28" />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}
