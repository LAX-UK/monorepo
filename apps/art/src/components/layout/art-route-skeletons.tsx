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

function Placeholders({ count, className }: { count: number; className: string }) {
  return Array.from({ length: count }, (_, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
    <Skeleton key={index} className={className} />
  ));
}

/** Art Hub and Collector Hub: header, tabs row, landscape editorial cards. */
export function ArtEditorialListSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label}>
      <Skeleton className="mb-3 h-9 w-56" />
      <Skeleton className="mb-8 h-5 w-full max-w-xl" />
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <div key={index} className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/3] w-full rounded-md" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

/** Story, exhibition, guide and legal pages: title, optional cover, body copy. */
export function ArtArticleSkeleton({ label, cover = true }: { label: string; cover?: boolean }) {
  return (
    <LoadingRegion label={label}>
      <div className="flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-5 w-full" />
      </div>
      {cover ? <Skeleton className="my-8 aspect-[16/9] w-full rounded-md" /> : null}
      <div className={cn("flex max-w-3xl flex-col gap-3", !cover && "mt-8")}>
        <Placeholders count={6} className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </LoadingRegion>
  );
}

export function ArtVisitSkeleton() {
  return (
    <LoadingRegion label="Loading visit information">
      <Skeleton className="mb-3 h-9 w-32" />
      <Skeleton className="mb-10 h-5 w-full max-w-xl" />
      <div className="grid gap-x-6 gap-y-12 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <div key={index} className="flex flex-col gap-4">
            <Skeleton className="aspect-[4/3] w-full rounded-md" />
            <Skeleton className="h-7 w-1/2" />
            <Placeholders count={3} className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function ArtAccountSkeleton() {
  return (
    <LoadingRegion label="Loading account">
      <div className="flex flex-col items-center gap-4 py-10">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="mb-8 flex justify-center gap-6">
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-11 w-24" />
      </div>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </LoadingRegion>
  );
}
