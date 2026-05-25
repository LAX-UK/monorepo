import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";
import { MARKETING_PAGE_INNER, MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { readSkeletonView } from "@/lib/preferences/skeleton-view.server";
import { cn } from "@auction/ui";

export default async function SearchLoading() {
  const view = await readSkeletonView("search", "grid");

  return (
    <main
      id="main-content"
      className="bg-surface pb-[var(--page-bottom-padding)] pt-[var(--section-pt)]"
      aria-busy="true"
      aria-label="Loading search"
    >
      <header className={cn(MARKETING_PAGE_INNER, "flex flex-col gap-4 pb-6 pt-0 md:pb-8")}>
        <div className="animate-pulse space-y-3">
          <div className="h-10 w-48 rounded bg-surface-container-high" />
          <div className="h-4 w-full max-w-md rounded bg-surface-container-high" />
          <div className="h-3 w-32 rounded bg-surface-container-high" />
        </div>
      </header>

      <div className={MARKETING_PAGE_SHELL}>
        <div className="mb-6 hidden animate-pulse md:block">
          <div className="h-4 w-24 rounded bg-surface-container-high" />
          <div className="mt-2 h-11 rounded border-b-2 border-border-hairline bg-surface-container-high/50" />
        </div>

        <div className="-mx-8 animate-pulse border-b border-border-hairline bg-surface/85 py-3 md:-mx-10 lg:-mx-14">
          <div className="flex flex-col gap-2 md:gap-0">
            <div className="flex h-12 min-w-0 items-center gap-3">
              <div className="h-4 w-16 shrink-0 rounded bg-surface-container-high" />
              <div className="h-10 w-24 shrink-0 rounded bg-surface-container-high md:hidden" />
              <div className="hidden h-8 flex-1 gap-2 md:flex">
                <div className="h-8 w-16 rounded-full bg-surface-container-high" />
                <div className="h-8 w-20 rounded-full bg-surface-container-high" />
                <div className="h-8 w-24 rounded-full bg-surface-container-high" />
              </div>
              <div className="ml-auto hidden h-10 w-28 shrink-0 rounded bg-surface-container-high md:block" />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border-hairline pt-2 md:hidden">
              <div className="h-10 w-24 rounded bg-surface-container-high" />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <MarketingListSkeleton view={view} />
        </div>
      </div>
    </main>
  );
}
