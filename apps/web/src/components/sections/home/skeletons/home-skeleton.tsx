import { HOME_HERO_BLEED, HOME_HERO_MIN_H } from "@/lib/marketing/home-hero-layout";
import { Skeleton, cn } from "@auction/ui";

/** F5b — Per-section skeleton mirroring the actual home composition.
 *
 * Replaces the generic `<div className="animate-pulse" />` Suspense fallback.
 * Each block roughly matches the dimensions of the rendered section so the
 * layout doesn't shift when content streams in.
 */
export function HomeSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <div className={HOME_HERO_BLEED}>
        <Skeleton className={cn("w-full rounded-none shimmer-sweep", HOME_HERO_MIN_H)} />
      </div>
      <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] px-6 py-12 md:px-10 lg:px-14">
        <Skeleton className="mb-8 h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {["a", "b", "c", "d", "e", "f"].map((slot) => (
            <Skeleton key={slot} className="aspect-[3/4] w-full rounded-sm shimmer-sweep" />
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] px-8 pt-10 md:px-10 lg:px-14">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Skeleton className="h-[60px] w-[min(100%,420px)] rounded-sm shimmer-sweep" />
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-8 w-48 rounded-lg shimmer-sweep" />
            <Skeleton className="h-6 w-24 rounded-sm shimmer-sweep" />
          </div>
        </div>
        <Skeleton className="mb-8 h-12 w-full rounded-lg border border-border-hairline shimmer-sweep" />
        <div className="flex flex-col gap-8">
          {["a", "b"].map((slot) => (
            <div key={slot} className="flex flex-row gap-6">
              <Skeleton className="h-[150px] w-[220px] shrink-0 rounded-sm shimmer-sweep" />
              <div className="flex min-w-0 flex-1 flex-col gap-4 pt-1">
                <Skeleton className="h-4 w-full max-w-md rounded-sm shimmer-sweep" />
                <Skeleton className="h-5 w-full max-w-sm rounded-sm shimmer-sweep" />
                <Skeleton className="h-4 w-24 rounded-sm shimmer-sweep" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] px-8 pt-10 md:px-10 lg:px-14">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[60px] w-[min(100%,360px)] rounded-sm shimmer-sweep" />
            <Skeleton className="h-9 w-[min(100%,520px)] rounded-sm shimmer-sweep" />
          </div>
          <Skeleton className="h-6 w-28 rounded-sm shimmer-sweep" />
        </div>
        <div className="flex gap-4 overflow-hidden pb-2">
          {["e1", "e2", "e3"].map((slot) => (
            <div key={slot} className="flex w-[280px] shrink-0 flex-col gap-4">
              <Skeleton className="h-[340px] w-full rounded-sm shimmer-sweep" />
              <Skeleton className="h-6 w-full rounded-sm shimmer-sweep" />
              <Skeleton className="h-4 w-[70%] rounded-sm shimmer-sweep" />
              <Skeleton className="h-10 w-full rounded-sm shimmer-sweep" />
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[var(--container-inner,1376px)] flex-col gap-8 px-8 pt-10 md:px-10 lg:flex-row lg:items-center lg:gap-14 lg:px-14">
        <div className="flex max-w-xl flex-1 flex-col gap-4">
          <Skeleton className="h-12 w-[min(100%,340px)] rounded-sm shimmer-sweep" />
          <Skeleton className="h-24 w-full rounded-sm shimmer-sweep" />
          <Skeleton className="h-12 w-56 rounded-sm shimmer-sweep" />
        </div>
        <Skeleton className="aspect-[676/400] w-full max-w-[676px] shrink-0 rounded-sm shimmer-sweep" />
      </div>
    </div>
  );
}
