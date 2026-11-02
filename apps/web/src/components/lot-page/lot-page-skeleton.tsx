import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { LaxDensityProvider, Skeleton, laxDensityAttributes } from "@auction/ui/lax";

/**
 * The lot page while it loads: the real layout at its final size (the mat, the identity lines, the
 * price block and its button), so nothing jumps when the lot arrives.
 */
export function LotPageSkeleton() {
  return (
    <LaxDensityProvider density="client">
      <section
        aria-busy="true"
        aria-label="Loading the lot"
        {...laxDensityAttributes("client")}
        className={cn(
          MARKETING_PAGE_SHELL,
          "pt-[calc(var(--header-height)+1rem)] pb-[var(--page-bottom-padding)] font-lax",
        )}
      >
        <div className="flex min-h-9 items-center py-4 md:pt-5">
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-14">
          <div className="-mx-4 aspect-[5/4] bg-lax-sunken md:mx-0 md:aspect-square md:rounded-xl" />
          <div className="min-w-0">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-4 h-4 w-44" />
            <Skeleton className="mt-3 h-7 w-4/5" />
            <Skeleton className="mt-3 h-4 w-3/5" />
            <div className="mt-6 rounded-lax-card border border-lax-line p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-8 w-36" />
              <Skeleton className="mt-2 h-3 w-28" />
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-lax-line-subtle pt-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="mt-5 h-11 w-full rounded-lax-control" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Skeleton className="h-lax-control-md w-full rounded-lax-control" />
              <Skeleton className="h-lax-control-md w-full rounded-lax-control" />
            </div>
          </div>
        </div>
        <output className="sr-only">Loading the lot</output>
      </section>
    </LaxDensityProvider>
  );
}
