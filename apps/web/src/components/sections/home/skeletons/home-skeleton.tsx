import { MarketingHangSkeleton } from "@auction/marketing-ui/hang/marketing-hang-skeleton";
import { Skeleton } from "@auction/ui/components/skeleton";

/** The page frame Home renders its sections in (`app/(marketing)/(home)/page.tsx`). */
export const HOME_PAGE_FRAME = "bg-page-bg pt-[var(--header-height)]";

/**
 * Home while it loads, in the shape of Home: the cover, the hang, then the sections, each block at
 * the size of what replaces it, so nothing moves when the page streams in. It is both the route's
 * loading screen and the page's own Suspense fallback. Every block is the shared skeleton
 * (`.lax-skeleton`): nothing shows for the first 150ms, then an opacity pulse.
 */
export function HomeSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="lax-skeleton h-[420px] w-full bg-surface-container-low md:h-[640px] min-[1600px]:h-[720px]" />
      <MarketingHangSkeleton />
      <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] px-4 py-12 md:px-6 lg:px-10">
        <Skeleton className="mb-8 h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {["a", "b", "c", "d", "e", "f"].map((slot) => (
            <Skeleton key={slot} className="aspect-[3/4] w-full rounded-sm" />
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] px-4 pt-10 md:px-6 lg:px-10">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Skeleton className="h-[60px] w-[min(100%,420px)] rounded-sm" />
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-6 w-24 rounded-sm" />
          </div>
        </div>
        <Skeleton className="mb-8 h-12 w-full rounded-lg border border-border-hairline" />
        <div className="flex flex-col gap-8">
          {["a", "b"].map((slot) => (
            <div key={slot} className="flex flex-row gap-6">
              <Skeleton className="h-[150px] w-[220px] shrink-0 rounded-sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-4 pt-1">
                <Skeleton className="h-4 w-full max-w-md rounded-sm" />
                <Skeleton className="h-5 w-full max-w-sm rounded-sm" />
                <Skeleton className="h-4 w-24 rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] px-4 pt-10 md:px-6 lg:px-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[60px] w-[min(100%,360px)] rounded-sm" />
            <Skeleton className="h-9 w-[min(100%,520px)] rounded-sm" />
          </div>
          <Skeleton className="h-6 w-28 rounded-sm" />
        </div>
        <div className="flex gap-4 overflow-hidden pb-2">
          {["e1", "e2", "e3"].map((slot) => (
            <div key={slot} className="flex w-[280px] shrink-0 flex-col gap-4">
              <Skeleton className="h-[340px] w-full rounded-sm" />
              <Skeleton className="h-6 w-full rounded-sm" />
              <Skeleton className="h-4 w-[70%] rounded-sm" />
              <Skeleton className="h-10 w-full rounded-sm" />
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[var(--container-inner,1376px)] flex-col gap-8 px-4 pt-10 md:px-6 lg:flex-row lg:items-center lg:gap-14 lg:px-10">
        <div className="flex max-w-xl flex-1 flex-col gap-4">
          <Skeleton className="h-12 w-[min(100%,340px)] rounded-sm" />
          <Skeleton className="h-24 w-full rounded-sm" />
          <Skeleton className="h-12 w-56 rounded-sm" />
        </div>
        <Skeleton className="aspect-[676/400] w-full max-w-[676px] shrink-0 rounded-sm" />
      </div>
    </div>
  );
}

/** Home's route loading screen: the skeleton in the page's own frame. */
export function HomeLoading() {
  return (
    <div className={HOME_PAGE_FRAME} aria-busy="true">
      <HomeSkeleton />
    </div>
  );
}
