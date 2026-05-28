import { MarketingCatalogToolbarSkeleton } from "@/components/marketing/marketing-catalog-toolbar-skeleton";
import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";
import {
  MARKETING_CATALOG_PT,
  MARKETING_PAGE_INNER,
  MARKETING_PAGE_SHELL,
} from "@/lib/marketing/chrome";
import { readSkeletonView } from "@/lib/preferences/skeleton-view.server";
import { cn } from "@auction/ui";

export default async function SearchLoading() {
  const view = await readSkeletonView("search", "grid");

  return (
    <main
      id="main-content"
      className={cn("bg-surface pb-[var(--page-bottom-padding)]", MARKETING_CATALOG_PT)}
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

        <MarketingCatalogToolbarSkeleton />

        <div className="mt-8">
          <MarketingListSkeleton view={view} />
        </div>
      </div>
    </main>
  );
}
